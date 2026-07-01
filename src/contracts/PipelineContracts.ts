import { z } from "zod";
import {
  AgentTraceSchema,
  AuditRecordSchema,
  RawRecordSchema,
  WorkRecordSchema,
  type AgentTrace,
  type AuditRecord,
  type RawRecord,
  type WorkRecord,
} from "../types/contracts.js";

export const PipelineStageSchema = z.enum([
  "intake",
  "normalize",
  "exception",
  "review",
  "delivery",
]);

export type PipelineStage = z.infer<typeof PipelineStageSchema>;

export const PipelineContextSchema = z.object({
  stage: PipelineStageSchema,
  raw_records: z.array(RawRecordSchema),
  records: z.array(WorkRecordSchema),
  audit_records: z.array(AuditRecordSchema),
  traces: z.record(z.string(), z.array(AgentTraceSchema)),
});

export interface PipelineContext {
  stage: PipelineStage;
  raw_records: RawRecord[];
  records: WorkRecord[];
  audit_records: AuditRecord[];
  traces: Record<string, AgentTrace[]>;
}

export interface PipelineStep {
  readonly name: PipelineStage;
  run(context: PipelineContext): Promise<PipelineContext>;
}
