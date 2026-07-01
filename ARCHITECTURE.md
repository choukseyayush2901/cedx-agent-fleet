# Architecture

## Flow

`feed.json`, PDFs, and emails enter through `FeedParser`, `PdfParser`, and `EmailParser`.

The OOP pipeline is:

1. `IntakePipeline`
2. `NormalizePipeline`
3. `ExceptionPipeline`
4. `RouterAgent`
5. `OrchestratorAgent`
6. `WorkerAgent`
7. `VerifierAgent`
8. `ApprovalStateMachine`
9. `DeliveryPipeline`
10. `AuditLogger`

## Agent Contracts

All concrete agents extend `BaseAgent` and expose `execute(message)`.

- `RouterAgent`: input `AgentMessage`, output route decision `{ model, difficulty, trace }`, can call `OrchestratorAgent`.
- `OrchestratorAgent`: input `AgentMessage`, output delivery or route result, can call `WorkerAgent` and `VerifierAgent`.
- `WorkerAgent`: input `AgentMessage`, output structured delivery fields plus transcript hashes.
- `VerifierAgent`: input source record plus Worker output, output verdict and optional reason code.

## Verifier Overrule

The Verifier compares Worker output to source `id`, `owner`, `amount`, and `category`. If a Worker follows hostile notes or invents an unsupported value, the Verifier emits `AGENT_HALLUCINATION`, appends an `overruled` span, and the Orchestrator routes the record to exception.

## Audit Backbone

Every non-superseded record carries ordered `agent_trace` spans. Delivered fields hash to Worker transcripts in `transcripts/*.json`. `out/audit.json` includes roster, costs, records, approvals, and append-only-shaped events.
