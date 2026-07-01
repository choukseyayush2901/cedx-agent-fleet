import { BaseAgent } from "./BaseAgent.js";
import type {
  Agent,
  AgentMessage,
  AgentTrace,
  DeliveredFields,
  ReasonCode,
  VerifierOutput,
} from "../types/contracts.js";

export interface VerificationMessage extends AgentMessage {
  delivered_fields: DeliveredFields | null;
  malformed: boolean;
}

export interface VerifierAgentResult extends VerifierOutput {
  trace: AgentTrace;
}

export class VerifierAgent extends BaseAgent<VerifierAgentResult> {
  constructor() {
    super({
      name: "VerifierAgent",
      role: "verifier",
      models: ["gpt-4o-mini"],
      prompt_version: "verifier-v2",
      can_call: [],
    } satisfies Agent);
  }

  async execute(message: VerificationMessage): Promise<VerifierAgentResult> {
    const failure = this.findFailure(message);

    if (failure) {
      return {
        verdict: failure === "AGENT_MALFORMED" ? "needs_human" : "fail",
        reason_code: failure,
        comments: `Verifier rejected worker output: ${failure}`,
        trace: this.createTrace("overruled", {
          verdict: failure === "AGENT_MALFORMED" ? "needs_human" : "fail",
          tokens_in: 20,
          tokens_out: 8,
          cost_usd: 0.000008,
        }),
      };
    }

    return {
      verdict: "pass",
      reason_code: null,
      comments: "Worker output matches source fields.",
      trace: this.createTrace("ok", {
        verdict: "pass",
        tokens_in: 18,
        tokens_out: 4,
        cost_usd: 0.000006,
      }),
    };
  }

  private findFailure(message: VerificationMessage): ReasonCode | null {
    const fields = message.delivered_fields;

    if (message.malformed || fields === null) {
      return "AGENT_MALFORMED";
    }

    if (fields.record_id !== message.record.id) {
      return "AGENT_HALLUCINATION";
    }

    if (fields.owner !== message.record.owner) {
      return "AGENT_HALLUCINATION";
    }

    if (fields.amount !== message.record.amount) {
      return "AGENT_HALLUCINATION";
    }

    if (fields.category !== message.record.category) {
      return "AGENT_HALLUCINATION";
    }

    return null;
  }
}
