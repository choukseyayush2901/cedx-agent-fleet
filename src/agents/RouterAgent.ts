import { BaseAgent } from "./BaseAgent.js";
import type { Agent, AgentMessage, AgentTrace } from "../types/contracts.js";

export interface RouteDecision {
  model: string;
  difficulty: "cheap" | "strong";
  trace: AgentTrace;
}

export class RouterAgent extends BaseAgent<RouteDecision> {
  constructor() {
    super({
      name: "RouterAgent",
      role: "router",
      models: ["gpt-4o-mini", "gpt-4o"],
      prompt_version: "router-v2",
      can_call: ["OrchestratorAgent"],
    } satisfies Agent);
  }

  async execute(message: AgentMessage): Promise<RouteDecision> {
    const hard =
      message.record.amount !== null &&
      (message.record.amount >= 10000 ||
        /ambiguous|inconsistent|unclear/i.test(message.record.notes));
    const model = hard ? "gpt-4o" : "gpt-4o-mini";

    return {
      model,
      difficulty: hard ? "strong" : "cheap",
      trace: this.createTrace("routed", {
        model,
        tokens_in: 8,
        tokens_out: 4,
        cost_usd: hard ? 0.00004 : 0.000004,
      }),
    };
  }
}
