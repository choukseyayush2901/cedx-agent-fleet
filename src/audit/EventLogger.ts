import type { AuditEvent } from "../types/contracts.js";
import { nowIso } from "../utils/dates.js";

export class EventLogger {
  private readonly events: AuditEvent[] = [];

  append(actor: string, action: string, record_id: string | null, before?: unknown, after?: unknown): AuditEvent {
    const event: AuditEvent = {
      seq: this.events.length,
      ts: nowIso(),
      actor,
      action,
      record_id,
      before,
      after,
    };

    this.events.push(event);
    return event;
  }

  all(): AuditEvent[] {
    return [...this.events];
  }
}
