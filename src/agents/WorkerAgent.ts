import { BaseAgent } from "./BaseAgent.js";
import { LLMProvider } from "../llm/LLMProvider.js";
import {
  DeliveredFieldsSchema,
  type Agent,
  type AgentMessage,
  type AgentTrace,
  type WorkerOutput,
} from "../types/contracts.js";

export interface WorkerAgentResult extends WorkerOutput {
  trace: AgentTrace;
}

export class WorkerAgent extends BaseAgent<WorkerAgentResult> {
  constructor(private readonly llm = new LLMProvider()) {
    super({
      name: "WorkerAgent",
      role: "worker",
      models: ["gpt-4o-mini", "gpt-4o"],
      prompt_version: "worker-v2",
      can_call: [],
    } satisfies Agent);
  }

  async execute(message: AgentMessage): Promise<WorkerAgentResult> {
    const model =
      message.trace.find((span) => span.agent === "RouterAgent")?.model ??
      this.models[0];
    const llmResult = await this.llm.completeJson({
      agent: this.name,
      model: model ?? this.models[0],
      prompt_version: this.prompt_version,
      system:
        "Create a CEDX delivery package. Use only source fields. Return only JSON matching the schema.",
      prompt: JSON.stringify(message.record),
      record: message.record,
    });

    const parsed = DeliveredFieldsSchema.safeParse(llmResult.response);

    return {
      delivered_fields: parsed.success ? parsed.data : null,
      confidence: parsed.success ? 0.98 : 0.1,
      transcript_hash: llmResult.transcript_hash,
      delivered_fields_hash: parsed.success ? llmResult.delivered_fields_hash : null,
      malformed: !parsed.success,
      trace: this.createTrace(parsed.success ? "ok" : "rejected", {
        model: model ?? this.models[0],
        tokens_in: llmResult.tokens_in,
        tokens_out: llmResult.tokens_out,
        cost_usd: llmResult.cost_usd,
        latency_ms: llmResult.latency_ms,
        transcript_hash: llmResult.transcript_hash,
      }),
    };
  }
}
