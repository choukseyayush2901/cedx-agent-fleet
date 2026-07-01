import { PDFParse } from "pdf-parse";
import { RawRecordSchema, type RawRecord } from "../types/contracts.js";
import { parseKeyValueText } from "./EmailParser.js";

export class PdfParser {
  async parseFile(path: string): Promise<RawRecord> {
    const parser = new PDFParse({ url: path });

    try {
      const result = await parser.getText();
      return this.parseText(result.text, path);
    } finally {
      await parser.destroy();
    }
  }

  parseText(text: string, path = "inline.pdf"): RawRecord {
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
      source_format: "pdf",
      source_path: path,
      source_payload: fields,
    });
  }
}

function numberOrNull(value: string | undefined): number | null {
  if (value === undefined || value.trim() === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
