import { prisma } from "../db/prisma.js";
import type { RecordStatus, WorkRecord } from "../types/contracts.js";

export class RecordService {
  async persist(record: WorkRecord, status: RecordStatus, reason_code?: string | null): Promise<void> {
    await prisma.record.upsert({
      where: { id: `${record.id}:v${record.version}` },
      update: {
        owner: record.owner,
        deadline: record.deadline,
        category: record.category,
        notes: record.notes,
        amount: record.amount,
        version: record.version,
        sourceFormat: record.source_format,
        status,
        reasonCode: reason_code ?? null,
      },
      create: {
        id: `${record.id}:v${record.version}`,
        owner: record.owner,
        deadline: record.deadline,
        category: record.category,
        notes: record.notes,
        amount: record.amount,
        version: record.version,
        sourceFormat: record.source_format,
        status,
        reasonCode: reason_code ?? null,
      },
    });
  }
}
