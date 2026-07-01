import type { PipelineContext, PipelineStep } from "../contracts/PipelineContracts.js";

export class IntakePipeline implements PipelineStep {
  readonly name = "intake";

  async run(context: PipelineContext): Promise<PipelineContext> {
    return {
      ...context,
      stage: this.name,
    };
  }
}
