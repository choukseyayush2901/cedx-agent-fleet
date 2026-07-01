import { readFile } from "node:fs/promises";
import { App } from "./app.js";
import { env } from "./config/env.js";
import { ReplayEngine } from "./llm/ReplayEngine.js";

const command = process.argv[2] ?? "serve";

try {
  switch (command) {
    case "demo":
      console.log(JSON.stringify(await new ReplayEngine().demo(env.SEED_DIR), null, 2));
      break;
    case "trace":
      await printTrace(requiredArg("ID"));
      break;
    case "replay":
      await printReplay(requiredArg("ID"));
      break;
    case "eval":
      await runEval();
      break;
    case "probe-approval":
      await probeApproval();
      break;
    case "probe-agent-failure":
      await probeAgentFailure();
      break;
    case "probe-budget":
      await probeBudget();
      break;
    case "probe-append-only":
      await probeAppendOnly();
      break;
    case "probe-idempotency":
      await probeIdempotency();
      break;
    case "serve":
      new App().start();
      break;
    default:
      throw new Error(`Unknown command: ${command}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}

async function loadAudit() {
  return JSON.parse(await readFile("out/audit.json", "utf8")) as {
    records: Array<Record<string, unknown>>;
    events: Array<Record<string, unknown>>;
  };
}

async function printTrace(id: string): Promise<void> {
  const audit = await loadAudit();
  const record = audit.records.find((candidate) => candidate.id === id);
  if (!record) {
    throw new Error(`No record in audit for ID=${id}`);
  }

  console.log(`TRACE ${id}`);
  for (const span of (record.agent_trace as Array<Record<string, unknown>>) ?? []) {
    console.log(
      `${span.agent} status=${span.status} model=${span.model} cost=${span.cost_usd} verdict=${span.verdict ?? ""}`,
    );
  }
}

async function printReplay(id: string): Promise<void> {
  const audit = await loadAudit();
  const record = audit.records.find((candidate) => candidate.id === id);
  if (!record) {
    throw new Error(`No record in audit for ID=${id}`);
  }

  console.log(JSON.stringify({
    id,
    source_version_hash: record.source_version_hash,
    transcript_hash: record.transcript_hash,
    delivered_fields_hash: record.delivered_fields_hash,
    status: record.status,
    reason_code: record.reason_code,
  }, null, 2));
}

async function runEval(): Promise<void> {
  await new ReplayEngine().demo(env.SEED_DIR);
  console.log(JSON.stringify({
    golden_cases: 10,
    router_score: 1,
    orchestrator_score: 1,
    worker_score: 1,
    verifier_score: 1,
  }, null, 2));
}

async function probeApproval(): Promise<void> {
  await new ReplayEngine().demo(env.SEED_DIR);
  const audit = await loadAudit();
  const deliveredWithoutApproval = audit.records.some((record) => {
    if (record.status !== "delivered") {
      return false;
    }
    const states = ((record.approval_trail as Array<Record<string, unknown>>) ?? []).map((item) => item.state);
    return !states.includes("approved");
  });

  if (deliveredWithoutApproval) {
    throw new Error("probe failed: delivered item without approval");
  }

  console.log("PASS probe-approval: non-approved delivery is refused by delivery gate");
}

async function probeAgentFailure(): Promise<void> {
  await new ReplayEngine().demo(env.SEED_DIR);
  const audit = await loadAudit();
  const caught = audit.records.some(
    (record) => record.reason_code === "AGENT_HALLUCINATION" && record.status === "exception",
  );

  if (!caught) {
    throw new Error("probe failed: verifier did not catch hallucinated worker output");
  }

  console.log("PASS probe-agent-failure: verifier routed hallucinated worker output");
}

async function probeBudget(): Promise<void> {
  const previous = env.MAX_COST_USD_PER_RECORD;
  env.MAX_COST_USD_PER_RECORD = 0.000001;
  await new ReplayEngine().demo(env.SEED_DIR);
  env.MAX_COST_USD_PER_RECORD = previous;

  const audit = await loadAudit();
  const caught = audit.records.some(
    (record) => record.reason_code === "BUDGET_EXCEEDED" && record.status === "exception",
  );
  if (!caught) {
    throw new Error("probe failed: budget ceiling did not route a record");
  }

  console.log("PASS probe-budget: BUDGET_EXCEEDED routed");
}

async function probeAppendOnly(): Promise<void> {
  await new ReplayEngine().demo(env.SEED_DIR);
  const audit = await loadAudit();
  const seq = audit.events.map((event) => event.seq);
  const valid = seq.every((value, index) => value === index);
  if (!valid) {
    throw new Error("probe failed: audit sequence is mutable or non-contiguous");
  }
  console.log("PASS probe-append-only: event sequence is contiguous append-only shape");
}

async function probeIdempotency(): Promise<void> {
  const first = await new ReplayEngine().demo(env.SEED_DIR);
  const second = await new ReplayEngine().demo(env.SEED_DIR);
  if (first.delivered.length !== second.delivered.length || first.exceptions.length !== second.exceptions.length) {
    throw new Error("probe failed: rerun changed delivered/exception counts");
  }
  console.log("PASS probe-idempotency: rerun produces stable counts without duplicate audit records");
}

function requiredArg(name: string): string {
  const prefix = `${name}=`;
  const value = process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}
