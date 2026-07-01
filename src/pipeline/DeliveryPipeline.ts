import type { PipelineContext, PipelineStep } from "../contracts/PipelineContracts.js";
import type { Approval, DeliveredFields } from "../types/contracts.js";

export class DeliveryPipeline implements PipelineStep {
  readonly name = "delivery";

  async run(context: PipelineContext): Promise<PipelineContext> {
    return {
      ...context,
      stage: this.name,
    };
  }

  canDeliver(approvalTrail: Approval[], deliveredFields: DeliveredFields | null): boolean {
    if (deliveredFields === null) {
      return false;
    }

    const states = approvalTrail.map((approval) => approval.state);
    return states.includes("approved") && !states.includes("blocked");
  }
}
