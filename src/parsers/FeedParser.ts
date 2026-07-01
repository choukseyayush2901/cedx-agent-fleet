import { readFile } from "node:fs/promises";
import { RawRecordSchema, type RawRecord } from "../types/contracts.js";

export class FeedParser {
  async parseFile(path: string): Promise<RawRecord[]> {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw) as Array<Record<string, unknown>>;

    return parsed.map((record) =>
      RawRecordSchema.parse({
        id: record.id,
        owner: record.owner,
        deadline: record.deadline,
        category: record.category,
        notes: record.notes,
        version: record.version,
        amount: record.amount,
        source_format: "feed",
        source_path: path,
        source_payload: record,
      }),
    );
  }
}
