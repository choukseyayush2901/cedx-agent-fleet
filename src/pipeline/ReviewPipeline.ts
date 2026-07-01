import type { PipelineContext, PipelineStep } from "../contracts/PipelineContracts.js";

export class ReviewPipeline implements PipelineStep {
  readonly name = "review";

  async run(context: PipelineContext): Promise<PipelineContext> {
    return {
      ...context,
      stage: this.name,
    };
  }
}
