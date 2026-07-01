import type {
  Agent,
  AgentMessage,
  AgentRole,
  AgentTrace,
  TraceStatus,
  VerifierVerdict,
} from "../types/contracts.js";

export abstract class BaseAgent<TOutput> {
  protected readonly name: string;
  protected readonly role: AgentRole;
  protected readonly models: string[];
  protected readonly prompt_version: string;
  protected readonly can_call: string[];

  constructor(config: Agent) {
    this.name = config.name;
    this.role = config.role;
    this.models = config.models;
    this.prompt_version = config.prompt_version;
    this.can_call = config.can_call;
  }

  abstract execute(message: AgentMessage): Promise<TOutput>;

  getMetadata(): Agent {
    return {
      name: this.name,
      role: this.role,
      models: this.models,
      prompt_version: this.prompt_version,
      can_call: this.can_call,
    };
  }

  protected createTrace(
    status: TraceStatus,
    overrides: Partial<AgentTrace> = {},
  ): AgentTrace {
    return {
      agent: this.name,
      model: overrides.model ?? this.models[0] ?? null,
      prompt_version: overrides.prompt_version ?? this.prompt_version,
      tokens_in: overrides.tokens_in ?? 0,
      tokens_out: overrides.tokens_out ?? 0,
      cost_usd: overrides.cost_usd ?? 0,
      latency_ms: overrides.latency_ms ?? 1,
      retries: overrides.retries ?? 0,
      transcript_hash: overrides.transcript_hash ?? null,
      status,
      verdict: overrides.verdict ?? null,
    };
  }

  protected verifierVerdict(verdict: VerifierVerdict): VerifierVerdict {
    return verdict;
  }
}
