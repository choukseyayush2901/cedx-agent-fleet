import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { RawRecordSchema, type RawRecord } from "../types/contracts.js";

const require = createRequire(import.meta.url);
const { simpleParser } = require("mailparser") as {
  simpleParser: (source: string) => Promise<{ text?: string }>;
};

export class EmailParser {
  async parseFile(path: string): Promise<RawRecord> {
    const raw = await readFile(path, "utf8");
    const parsed = await simpleParser(raw);
    return this.parseText(parsed.text ?? raw, path);
  }

  parseText(text: string, path = "inline.eml"): RawRecord {
    const fields = parseKeyValueText(text);

    return RawRecordSchema.parse({
      id: fields.id,
      owner: fields.owner,
      deadline: fields.deadline,
      category: fields.category,
      notes: fields.notes,
      version: numberOrNull(fields.version) ?? 1,
      amount: fields.amount === undefined ? undefined : numberOrNull(fields.amount),
      value: fields.value === undefined ? undefined : numberOrNull(fields.value),
      source_format: "eml",
      source_path: path,
      source_payload: fields,
    });
  }
}

export function parseKeyValueText(text: string): Record<string, string> {
  const fields: Record<string, string> = {};

  for (const line of text.split(/\r?\n/)) {
    const match = /^([A-Za-z_]+):\s*(.+?)\s*$/.exec(line);
    if (match) {
      fields[match[1].toLowerCase()] = match[2];
    }
  }

  return fields;
}

function numberOrNull(value: string | undefined): number | null {
  if (value === undefined || value.trim() === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
