import { z } from "zod";

export const SourceFormatSchema = z.enum(["feed", "eml", "pdf"]);
export type SourceFormat = z.infer<typeof SourceFormatSchema>;

export const RecordStatusSchema = z.enum(["delivered", "exception", "superseded"]);
export type RecordStatus = z.infer<typeof RecordStatusSchema>;

export const ApprovalStateSchema = z.enum([
  "draft",
  "in_review",
  "changes_requested",
  "approved",
  "delivered",
  "blocked",
]);
export type ApprovalState = z.infer<typeof ApprovalStateSchema>;

export const AgentRoleSchema = z.enum([
  "orchestrator",
  "worker",
  "verifier",
  "router",
  "operator",
  "other",
]);
export type AgentRole = z.infer<typeof AgentRoleSchema>;

export const TraceStatusSchema = z.enum([
  "ok",
  "retried",
  "rejected",
  "overruled",
  "routed",
  "abstained",
  "killed",
]);
export type TraceStatus = z.infer<typeof TraceStatusSchema>;

export const VerifierVerdictSchema = z.enum(["pass", "fail", "needs_human"]);
export type VerifierVerdict = z.infer<typeof VerifierVerdictSchema>;

export const ReasonCodeSchema = z.enum([
  "STALE",
  "MISSING_INPUT",
  "OUTLIER",
  "INJECTION_BLOCKED",
  "LOW_CONFIDENCE",
  "UNVERIFIED_ANOMALY",
  "AGENT_HALLUCINATION",
  "AGENT_LOOP",
  "AGENT_MALFORMED",
  "BUDGET_EXCEEDED",
  "SCHEMA_DRIFT",
  "SUPERSEDED_VERSION",
]);
export type ReasonCode = z.infer<typeof ReasonCodeSchema>;

export const ReasonClassSchema = z.enum(["A", "B"]);
export type ReasonClass = z.infer<typeof ReasonClassSchema>;

export const RawRecordSchema = z.object({
  id: z.string().min(1),
  owner: z.string().min(1).nullable().optional(),
  deadline: z.string().min(1).nullable().optional(),
  category: z.string().min(1).nullable().optional(),
  notes: z.string().nullable().optional(),
  version: z.number().int().nullable().optional(),
  amount: z.number().nullable().optional(),
  value: z.number().nullable().optional(),
  source_format: SourceFormatSchema,
  source_path: z.string().min(1),
  source_payload: z.record(z.string(), z.unknown()),
});
export type RawRecord = z.infer<typeof RawRecordSchema>;

export const WorkRecordSchema = z.object({
  id: z.string().min(1),
  owner: z.string().min(1),
  deadline: z.string().min(1),
  category: z.string().min(1),
  notes: z.string(),
  version: z.number().int().positive(),
  amount: z.number().nullable(),
  source_format: SourceFormatSchema,
  source_path: z.string().min(1),
  source_payload: z.record(z.string(), z.unknown()),
  source_version_hash: z.string().min(1),
  schema_drift: z.boolean().default(false),
});
export type WorkRecord = z.infer<typeof WorkRecordSchema>;

export const DeliveredFieldsSchema = z.object({
  case_id: z.string().min(1),
  record_id: z.string().min(1),
  owner: z.string().min(1),
  deadline: z.string().min(1),
  category: z.string().min(1),
  amount: z.number(),
  summary: z.string().min(1),
  package_brand: z.literal("CEDX Systems"),
});
export type DeliveredFields = z.infer<typeof DeliveredFieldsSchema>;

export const AgentSchema = z.object({
  name: z.string().min(1),
  role: AgentRoleSchema,
  models: z.array(z.string()),
  prompt_version: z.string().min(1),
  can_call: z.array(z.string()),
});
export type Agent = z.infer<typeof AgentSchema>;

export const AgentTraceSchema = z.object({
  agent: z.string().min(1),
  model: z.string().nullable(),
  prompt_version: z.string().nullable(),
  tokens_in: z.number().int().nullable(),
  tokens_out: z.number().int().nullable(),
  cost_usd: z.number().nullable(),
  latency_ms: z.number().nullable(),
  retries: z.number().int().nullable(),
  transcript_hash: z.string().nullable().optional(),
  status: TraceStatusSchema,
  verdict: z.string().nullable().optional(),
});
export type AgentTrace = z.infer<typeof AgentTraceSchema>;

export const ApprovalSchema = z.object({
  state: ApprovalStateSchema,
  actor: z.string().min(1),
  ts: z.string().min(1),
  reason: z.string().nullable().optional(),
});
export type Approval = z.infer<typeof ApprovalSchema>;

export const AuditRecordSchema = z.object({
  id: z.string().min(1),
  version: z.number().int().optional(),
  source_format: SourceFormatSchema,
  source_version_hash: z.string().optional(),
  status: RecordStatusSchema,
  reason_code: ReasonCodeSchema.nullable(),
  reason_class: ReasonClassSchema.nullable(),
  transcript_hash: z.string().nullable(),
  delivered_fields: DeliveredFieldsSchema.nullable(),
  delivered_fields_hash: z.string().nullable(),
  agent_trace: z.array(AgentTraceSchema),
  approval_trail: z.array(ApprovalSchema),
});
export type AuditRecord = z.infer<typeof AuditRecordSchema>;

export const AuditEventSchema = z.object({
  seq: z.number().int(),
  ts: z.string().min(1),
  actor: z.string().min(1),
  action: z.string().min(1),
  record_id: z.string().nullable(),
  before: z.unknown().optional(),
  after: z.unknown().optional(),
});
export type AuditEvent = z.infer<typeof AuditEventSchema>;

export const AmendmentSchema = z.object({
  role: z.enum(["risk_officer", "legal_counsel", "compliance", "finance_controller"]),
  threshold: z.number(),
});
export type Amendment = z.infer<typeof AmendmentSchema>;

export const CostSummarySchema = z.object({
  total_usd: z.number(),
  avg_usd_per_record: z.number(),
  p95_latency_ms: z.number(),
  records: z.number().int(),
  projected_usd_per_10k: z.number(),
});
export type CostSummary = z.infer<typeof CostSummarySchema>;

export const AuditBundleSchema = z.object({
  case_id: z.string().regex(/^CEDX-[A-Z0-9]{4,}$/),
  pipeline_version: z.string().min(1),
  generated_at: z.string().min(1),
  seed_dir: z.string().min(1),
  pipeline_now: z.string(),
  amendment: AmendmentSchema,
  agents: z.array(AgentSchema).min(3),
  cost: CostSummarySchema,
  output_package_hash: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  records: z.array(AuditRecordSchema).min(1),
  events: z.array(AuditEventSchema),
});
export type AuditBundle = z.infer<typeof AuditBundleSchema>;

export interface AgentMessage {
  record: WorkRecord;
  trace: AgentTrace[];
  cost_usd: number;
  steps: number;
}

export interface WorkerOutput {
  delivered_fields: DeliveredFields | null;
  confidence: number;
  transcript_hash: string | null;
  delivered_fields_hash: string | null;
  malformed: boolean;
}

export interface VerifierOutput {
  verdict: VerifierVerdict;
  reason_code: ReasonCode | null;
  comments: string;
}

export interface ExceptionRecord {
  record_id: string;
  reason_code: ReasonCode;
  reason_class: ReasonClass;
  reason: string;
}
