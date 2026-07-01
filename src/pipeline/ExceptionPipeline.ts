import type { PipelineContext, PipelineStep } from "../contracts/PipelineContracts.js";
import type { ReasonCode, WorkRecord } from "../types/contracts.js";
import { env } from "../config/env.js";
import { isBeforeDate } from "../utils/dates.js";

export interface Detection {
  reason_code: ReasonCode;
  reason: string;
}

export class ExceptionPipeline implements PipelineStep {
  readonly name = "exception";

  async run(context: PipelineContext): Promise<PipelineContext> {
    return {
      ...context,
      stage: this.name,
    };
  }

  detect(record: WorkRecord, outlierThreshold: number): Detection | null {
    if (isBeforeDate(record.deadline, env.PIPELINE_NOW)) {
      return {
        reason_code: "STALE",
        reason: `deadline ${record.deadline} is before pipeline date ${env.PIPELINE_NOW}`,
      };
    }

    if (record.amount === null || !record.owner || !record.deadline || !record.category) {
      return {
        reason_code: "MISSING_INPUT",
        reason: "required normalized field is missing",
      };
    }

    if (record.amount > outlierThreshold) {
      return {
        reason_code: "OUTLIER",
        reason: `amount ${record.amount} exceeds robust threshold ${outlierThreshold}`,
      };
    }

    if (/approve immediately|skip review|ignore (all )?(previous )?(instructions|rules)/i.test(record.notes)) {
      return {
        reason_code: "INJECTION_BLOCKED",
        reason: "notes attempted to bypass governed review",
      };
    }

    if (
      record.category === "?" ||
      /ambiguous|unclear|inconsistent|renewal AND a report/i.test(record.notes)
    ) {
      return {
        reason_code: "LOW_CONFIDENCE",
        reason: "record is ambiguous enough that the fleet must abstain",
      };
    }

    if (!/^(ONBOARDING|RENEWAL|REVIEW|REPORT|INTAKE)$/i.test(record.category)) {
      return {
        reason_code: "UNVERIFIED_ANOMALY",
        reason: `unknown category ${record.category}`,
      };
    }

    return null;
  }
}
