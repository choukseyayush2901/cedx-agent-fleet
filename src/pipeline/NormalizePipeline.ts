import type { PipelineContext, PipelineStep } from "../contracts/PipelineContracts.js";
import { WorkRecordSchema, type RawRecord, type WorkRecord } from "../types/contracts.js";
import { sha256Uri } from "../utils/hash.js";

export class NormalizePipeline implements PipelineStep {
  readonly name = "normalize";

  async run(context: PipelineContext): Promise<PipelineContext> {
    const records = context.raw_records.map((record) => this.normalize(record));

    return {
      ...context,
      stage: this.name,
      records,
    };
  }

  normalize(record: RawRecord): WorkRecord {
    const amount = record.amount ?? record.value ?? null;

    return WorkRecordSchema.parse({
      id: record.id,
      owner: record.owner,
      deadline: record.deadline,
      category: record.category,
      notes: record.notes ?? "",
      version: record.version ?? 1,
      amount,
      source_format: record.source_format,
      source_path: record.source_path,
      source_payload: record.source_payload,
      source_version_hash: sha256Uri(record.source_payload),
      schema_drift: record.amount === undefined && record.value !== undefined,
    });
  }
}
