import type { AuditRecord, ReasonClass, ReasonCode, WorkRecord } from "../types/contracts.js";
import { ApprovalStateMachine } from "../approval/ApprovalStateMachine.js";

export class ExceptionService {
  constructor(private readonly approvals = new ApprovalStateMachine()) {}

  build(record: WorkRecord, reason_code: ReasonCode, reason_class: ReasonClass, reason: string): AuditRecord {
    return {
      id: record.id,
      version: record.version,
      source_format: record.source_format,
      source_version_hash: record.source_version_hash,
      status: "exception",
      reason_code,
      reason_class,
      transcript_hash: null,
      delivered_fields: null,
      delivered_fields_hash: null,
      agent_trace: [],
      approval_trail: this.approvals.blocked(reason),
    };
  }
}
