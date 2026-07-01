import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { RouterAgent } from "../agents/RouterAgent.js";
import { OrchestratorAgent } from "../agents/OrchestratorAgent.js";
import { ApprovalStateMachine } from "../approval/ApprovalStateMachine.js";
import { AuditLogger } from "../audit/AuditLogger.js";
import { EventLogger } from "../audit/EventLogger.js";
import { env } from "../config/env.js";
import { NormalizePipeline } from "../pipeline/NormalizePipeline.js";
import { ExceptionPipeline } from "../pipeline/ExceptionPipeline.js";
import { FeedParser } from "../parsers/FeedParser.js";
import { EmailParser } from "../parsers/EmailParser.js";
import { PdfParser } from "../parsers/PdfParser.js";
import { RecordService } from "../services/RecordService.js";
import { OutputWriter } from "../storage/OutputWriter.js";
import {
  type AgentTrace,
  type Amendment,
  type AuditBundle,
  type AuditRecord,
  type RawRecord,
  type ReasonCode,
  type WorkRecord,
} from "../types/contracts.js";
import { nowIso, percentile } from "../utils/dates.js";
import { sha256Hex, sha256Uri } from "../utils/hash.js";
import { logger } from "../utils/logger.js";

export interface DemoResult {
  audit_path: string;
  package_path: string;
  delivered: string[];
  exceptions: string[];
}

export class ReplayEngine {
  private readonly feedParser = new FeedParser();
  private readonly emailParser = new EmailParser();
  private readonly pdfParser = new PdfParser();
  private readonly normalizer = new NormalizePipeline();
  private readonly exceptions = new ExceptionPipeline();
  private readonly router = new RouterAgent();
  private readonly orchestrator = new OrchestratorAgent();
  private readonly approvals = new ApprovalStateMachine();
  private readonly recordService = new RecordService();
  private readonly outputWriter = new OutputWriter();
  private readonly events = new EventLogger();
  private readonly audit = new AuditLogger(this.events);

  async demo(seedDir = env.SEED_DIR): Promise<DemoResult> {
    const amendment = deriveAmendment(env.CASE_ID);
    console.log(`AMENDMENT: role=${amendment.role} threshold=${amendment.threshold}`);

    const rawRecords = await this.loadRawRecords(seedDir);
    this.audit.event("system", "intake.loaded", null, null, { count: rawRecords.length });

    const context = await this.normalizer.run({
      stage: "intake",
      raw_records: rawRecords,
      records: [],
      audit_records: [],
      traces: {},
    });

    const { current, superseded } = selectLatestVersions(context.records);
    const threshold = robustOutlierThreshold(current);
    const auditRecords: AuditRecord[] = [];

    for (const record of superseded) {
      const auditRecord: AuditRecord = {
        id: record.id,
        version: record.version,
        source_format: record.source_format,
        source_version_hash: record.source_version_hash,
        status: "superseded",
        reason_code: "SUPERSEDED_VERSION",
        reason_class: "B",
        transcript_hash: null,
        delivered_fields: null,
        delivered_fields_hash: null,
        agent_trace: [],
        approval_trail: [],
      };
      auditRecords.push(auditRecord);
      this.audit.event("system", "record.superseded", record.id, null, auditRecord);
      await this.recordService.persist(record, "superseded", "SUPERSEDED_VERSION");
    }

    for (const record of current) {
      const processed = await this.processRecord(record, amendment, threshold);
      auditRecords.push(processed);
    }

    const delivered = auditRecords.filter((record) => record.status === "delivered");
    const packageData = {
      case_id: env.CASE_ID,
      generated_at: nowIso(),
      industry: "Operations",
      brand: "CEDX Systems",
      records: delivered.map((record) => record.delivered_fields),
    };
    const packageWrite = await this.outputWriter.writeJson("package.json", packageData);

    const allSpans = auditRecords.flatMap((record) => record.agent_trace);
    const totalCost = roundMoney(allSpans.reduce((sum, span) => sum + (span.cost_usd ?? 0), 0));
    const auditBundle: AuditBundle = {
      case_id: env.CASE_ID,
      pipeline_version: "cedx-agent-fleet-v2",
      generated_at: nowIso(),
      seed_dir: seedDir,
      pipeline_now: env.PIPELINE_NOW,
      amendment,
      agents: [
        this.router.getMetadata(),
        this.orchestrator.getMetadata(),
        ...this.orchestratorAgents(),
      ],
      cost: {
        total_usd: totalCost,
        avg_usd_per_record: roundMoney(totalCost / Math.max(1, current.length)),
        p95_latency_ms: percentile(
          auditRecords.map((record) =>
            record.agent_trace.reduce((sum, span) => sum + (span.latency_ms ?? 0), 0),
          ),
          95,
        ),
        records: current.length,
        projected_usd_per_10k: roundMoney((totalCost / Math.max(1, current.length)) * 10000),
      },
      output_package_hash: packageWrite.hash,
      records: auditRecords.sort((left, right) => left.id.localeCompare(right.id) || (left.version ?? 0) - (right.version ?? 0)),
      events: this.events.all(),
    };

    await this.audit.writeBundle("out/audit.json", auditBundle);

    return {
      audit_path: "out/audit.json",
      package_path: packageWrite.path,
      delivered: delivered.map((record) => record.id),
      exceptions: auditRecords
        .filter((record) => record.status === "exception")
        .map((record) => record.id),
    };
  }

  private orchestratorAgents() {
    return [
      {
        name: "WorkerAgent",
        role: "worker" as const,
        models: ["gpt-4o-mini", "gpt-4o"],
        prompt_version: "worker-v2",
        can_call: [],
      },
      {
        name: "VerifierAgent",
        role: "verifier" as const,
        models: ["gpt-4o-mini"],
        prompt_version: "verifier-v2",
        can_call: [],
      },
    ];
  }

  private async loadRawRecords(seedDir: string): Promise<RawRecord[]> {
    const rawRecords: RawRecord[] = [];
    rawRecords.push(...(await this.feedParser.parseFile(join(seedDir, "feed.json"))));

    const inboxDir = join(seedDir, "inbox");
    const files = await readdir(inboxDir);

    for (const file of files.sort()) {
      const path = join(inboxDir, file);
      if (file.endsWith(".eml")) {
        rawRecords.push(await this.emailParser.parseFile(path));
      } else if (file.endsWith(".pdf")) {
        rawRecords.push(await this.pdfParser.parseFile(path));
      }
    }

    return rawRecords;
  }

  private async processRecord(
    record: WorkRecord,
    amendment: Amendment,
    outlierThreshold: number,
  ): Promise<AuditRecord> {
    logger.info("processing record", { id: record.id, version: record.version });
    const route = await this.router.execute({
      record,
      trace: [],
      cost_usd: 0,
      steps: 0,
    });
    const trace: AgentTrace[] = [route.trace];

    const dataException = this.exceptions.detect(record, outlierThreshold);
    if (dataException) {
      trace.push({
        agent: "OrchestratorAgent",
        model: "rules-engine",
        prompt_version: "orchestrator-v2",
        tokens_in: 0,
        tokens_out: 0,
        cost_usd: 0,
        latency_ms: 1,
        retries: 0,
        transcript_hash: null,
        status: "routed",
        verdict: null,
      });

      const auditRecord = this.exceptionRecord(
        record,
        dataException.reason_code,
        dataException.reason,
        trace,
      );
      this.audit.exception(auditRecord);
      await this.recordService.persist(record, "exception", dataException.reason_code);
      return auditRecord;
    }

    const orchestration = await this.orchestrator.execute({
      record,
      trace,
      cost_usd: route.trace.cost_usd ?? 0,
      steps: 1,
    });
    trace.push(...orchestration.trace);

    if (orchestration.reason_code) {
      const auditRecord = this.exceptionRecord(
        record,
        orchestration.reason_code,
        `agent fleet routed record with ${orchestration.reason_code}`,
        trace,
      );
      this.audit.exception(auditRecord);
      await this.recordService.persist(record, "exception", orchestration.reason_code);
      return auditRecord;
    }

    if (orchestration.delivered_fields === null) {
      const auditRecord = this.exceptionRecord(
        record,
        "UNVERIFIED_ANOMALY",
        "worker produced no deliverable fields",
        trace,
      );
      this.audit.exception(auditRecord);
      await this.recordService.persist(record, "exception", "UNVERIFIED_ANOMALY");
      return auditRecord;
    }

    const approvalTrail = this.approvals.approveForDelivery(orchestration.delivered_fields, amendment);
    const auditRecord: AuditRecord = {
      id: record.id,
      version: record.version,
      source_format: record.source_format,
      source_version_hash: record.source_version_hash,
      status: "delivered",
      reason_code: record.schema_drift ? "SCHEMA_DRIFT" : null,
      reason_class: record.schema_drift ? "B" : null,
      transcript_hash: orchestration.transcript_hash,
      delivered_fields: orchestration.delivered_fields,
      delivered_fields_hash: orchestration.delivered_fields_hash,
      agent_trace: trace,
      approval_trail: approvalTrail,
    };

    if (record.schema_drift) {
      this.audit.event("system", "normalize.schema_drift", record.id, null, {
        mapped: "value -> amount",
      });
    }

    this.audit.delivered(auditRecord);
    await this.recordService.persist(record, "delivered", auditRecord.reason_code);
    return auditRecord;
  }

  private exceptionRecord(
    record: WorkRecord,
    reason_code: ReasonCode,
    reason: string,
    trace: AgentTrace[],
  ): AuditRecord {
    return {
      id: record.id,
      version: record.version,
      source_format: record.source_format,
      source_version_hash: record.source_version_hash,
      status: "exception",
      reason_code,
      reason_class: "A",
      transcript_hash: null,
      delivered_fields: null,
      delivered_fields_hash: null,
      agent_trace: trace,
      approval_trail: this.approvals.blocked(reason),
    };
  }
}

export function deriveAmendment(caseId: string): Amendment {
  const hash = sha256Hex(caseId);
  const roles = ["risk_officer", "legal_counsel", "compliance", "finance_controller"] as const;
  const role = roles[Number.parseInt(hash[0], 16) % roles.length];
  const threshold = 10000 + (Number.parseInt(hash.slice(1, 3), 16) % 50) * 1000;
  return { role, threshold };
}

function selectLatestVersions(records: WorkRecord[]): {
  current: WorkRecord[];
  superseded: WorkRecord[];
} {
  const groups = new Map<string, WorkRecord[]>();

  for (const record of records) {
    groups.set(record.id, [...(groups.get(record.id) ?? []), record]);
  }

  const current: WorkRecord[] = [];
  const superseded: WorkRecord[] = [];

  for (const group of groups.values()) {
    const sorted = group.sort((left, right) => right.version - left.version);
    current.push(sorted[0]);
    superseded.push(...sorted.slice(1));
  }

  return { current, superseded };
}

function robustOutlierThreshold(records: WorkRecord[]): number {
  const amounts = records
    .map((record) => record.amount)
    .filter((amount): amount is number => amount !== null)
    .sort((left, right) => left - right);

  if (amounts.length === 0) {
    return Number.POSITIVE_INFINITY;
  }

  const median = amounts[Math.floor(amounts.length / 2)];
  const deviations = amounts.map((amount) => Math.abs(amount - median)).sort((left, right) => left - right);
  const mad = deviations[Math.floor(deviations.length / 2)] || 1;
  return median + Math.max(10 * mad, median * 5);
}

function roundMoney(value: number): number {
  return Number(value.toFixed(6));
}

export { sha256Uri };
