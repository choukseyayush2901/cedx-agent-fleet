import { BaseAgent } from "./BaseAgent.js";
import { WorkerAgent } from "./WorkerAgent.js";
import { VerifierAgent } from "./VerifierAgent.js";
import type {
  Agent,
  AgentMessage,
  AgentTrace,
  DeliveredFields,
  ReasonCode,
} from "../types/contracts.js";
import { env } from "../config/env.js";

export interface OrchestratorResult {
  delivered_fields: DeliveredFields | null;
  transcript_hash: string | null;
  delivered_fields_hash: string | null;
  reason_code: ReasonCode | null;
  trace: AgentTrace[];
}

export class OrchestratorAgent extends BaseAgent<OrchestratorResult> {
  constructor(
    private readonly worker = new WorkerAgent(),
    private readonly verifier = new VerifierAgent(),
  ) {
    super({
      name: "OrchestratorAgent",
      role: "orchestrator",
      models: ["rules-engine"],
      prompt_version: "orchestrator-v2",
      can_call: ["WorkerAgent", "VerifierAgent"],
    } satisfies Agent);
  }

  async execute(message: AgentMessage): Promise<OrchestratorResult> {
    const trace: AgentTrace[] = [
      this.createTrace("ok", {
        model: "rules-engine",
        tokens_in: 0,
        tokens_out: 0,
        cost_usd: 0,
      }),
    ];

    if (message.steps + trace.length >= env.MAX_STEPS_PER_RECORD) {
      trace[0] = this.createTrace("killed", { model: "rules-engine" });
      return this.routed("AGENT_LOOP", trace);
    }

    const projectedCost = message.cost_usd + sumCost(message.trace) + sumCost(trace);
    if (projectedCost > env.MAX_COST_USD_PER_RECORD) {
      return this.routed("BUDGET_EXCEEDED", [
        ...trace,
        this.createTrace("routed", { model: "rules-engine" }),
      ]);
    }

    const worker = await this.worker.execute({
      ...message,
      trace: [...message.trace, ...trace],
    });
    trace.push(worker.trace);

    const verifier = await this.verifier.execute({
      ...message,
      trace: [...message.trace, ...trace],
      delivered_fields: worker.delivered_fields,
      malformed: worker.malformed,
    });
    trace.push(verifier.trace);

    if (verifier.verdict !== "pass") {
      return this.routed(verifier.reason_code ?? "UNVERIFIED_ANOMALY", trace);
    }

    return {
      delivered_fields: worker.delivered_fields,
      transcript_hash: worker.transcript_hash,
      delivered_fields_hash: worker.delivered_fields_hash,
      reason_code: null,
      trace,
    };
  }

  private routed(reason_code: ReasonCode, trace: AgentTrace[]): OrchestratorResult {
    return {
      delivered_fields: null,
      transcript_hash: null,
      delivered_fields_hash: null,
      reason_code,
      trace,
    };
  }
}

function sumCost(trace: AgentTrace[]): number {
  return trace.reduce((sum, span) => sum + (span.cost_usd ?? 0), 0);
}
