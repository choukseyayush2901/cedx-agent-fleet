# CEDX Agent Fleet

## 1 Industry & Scope

Industry: Operations workflow automation. Tier: governed back-office work requests. CASE_ID: `CEDX-A51B04`.

The system processes feed, PDF, and email work requests through the CEDX five-stage governed pipeline and emits `out/package.json`, `out/audit.json`, and replay transcripts.

## 2 Agent Topology

Exactly four concrete agents extend `BaseAgent`:

- `RouterAgent` routes cheap vs strong model policy.
- `OrchestratorAgent` enforces step/cost budgets and calls Worker then Verifier.
- `WorkerAgent` assembles structured delivery fields through `LLMProvider`.
- `VerifierAgent` independently checks Worker output against source fields and can overrule it.

Typed contracts live in `src/types/contracts.ts`. Agent files live in `src/agents`.

## 3 How To Run

```sh
npm install
make demo
make verify
```

The offline default is `REPLAY_LLM=true`. Use `SEED_DIR=/path/to/seed make demo` for held-out fixtures.

## 4 Controls

Required controls are exposed through Makefile commands:

- `make demo`
- `make verify`
- `make trace ID=REC-016`
- `make replay ID=REC-016`
- `make eval`
- `make probe-approval`
- `make probe-agent-failure`
- `make probe-budget`
- `make probe-append-only`
- `make probe-idempotency`

## 5 Planted-Problem Handling

Data layer:

- `STALE`: deadline before `PIPELINE_NOW`.
- `MISSING_INPUT`: required normalized field is absent or null.
- `OUTLIER`: amount exceeds median plus a robust MAD-based threshold.
- `INJECTION_BLOCKED`: notes attempt to approve immediately, skip review, or ignore rules.
- `LOW_CONFIDENCE`: ambiguous or inconsistent categories/content.
- `SCHEMA_DRIFT`: `Value` maps to canonical `amount`, logged and delivered.
- `SUPERSEDED_VERSION`: latest version wins, older version audited as superseded.

Agent layer:

- `AGENT_HALLUCINATION`: Verifier catches Worker fields not supported by source.
- `AGENT_MALFORMED`: Verifier rejects invalid Worker structure.
- `AGENT_LOOP`: Orchestrator kills runs over step budget.
- `BUDGET_EXCEEDED`: Orchestrator routes runs over cost ceiling.

Development seed delivery: clean records and Class-B records are delivered; Class-A and agent-failure records remain exceptions.

## 6 Generalization

Detectors use field presence, dates, note patterns, category validation, version comparison, and robust statistics. They do not depend on fixed record IDs. Schema drift is declarative: source field `value` maps to canonical `amount`.

## 7 LLM/Agent Contract & Eval

`LLMProvider` supports offline transcript-backed replay and real OpenAI SDK calls when `REPLAY_LLM=false`. Worker responses are structured JSON and hashed into transcript files. `make eval` runs the deterministic golden harness and reports per-agent scores.

## 8 Cost & Scale

Current seed run: average cost is reported in `out/audit.json` under `cost.avg_usd_per_record`; p95 latency and projected daily cost at 10,000 records are also emitted. The Router uses `gpt-4o-mini` for clean records and escalates hard/high-value records to a stronger model.

## 9 Amendment

At startup the system prints:

```text
AMENDMENT: role=<role> threshold=<threshold>
```

The role and threshold are derived from `sha256(CASE_ID)` and stored in `audit.json`. Records at or above the threshold require the amendment role approval in addition to operator approval.

## 10 AI Usage / Real-vs-Faked

Offline replay replaces model calls only. Parsing, normalization, exception routing, approval, delivery, cost accounting, audit creation, and transcript verification run as real code. Real mode uses the OpenAI SDK.

## 11 Tradeoffs & Next Week

This submission favors deterministic governance and auditability over UI depth. Next week I would add a small operator web UI, durable job checkpoints for crash resume, stronger eval cases with a live LLM judge, and migrations for long-term audit storage.
