import { writeFile } from "node:fs/promises";
import type { AuditBundle, AuditRecord } from "../types/contracts.js";
import { AuditBundleSchema } from "../types/contracts.js";
import { EventLogger } from "./EventLogger.js";

export class AuditLogger {
  constructor(private readonly eventLogger: EventLogger) {}

  event(actor: string, action: string, record_id: string | null, before?: unknown, after?: unknown): void {
    this.eventLogger.append(actor, action, record_id, before, after);
  }

  exception(record: AuditRecord): void {
    this.event("system", `exception.${record.reason_code}`, record.id, null, record);
  }

  delivered(record: AuditRecord): void {
    this.event("system", "delivery.delivered", record.id, null, record.delivered_fields);
  }

  async writeBundle(path: string, bundle: AuditBundle): Promise<void> {
    const parsed = AuditBundleSchema.parse(bundle);
    await writeFile(path, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
  }
}
