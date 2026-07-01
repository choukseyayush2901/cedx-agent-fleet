import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import OpenAI from "openai";
import { env } from "../config/env.js";
import {
  DeliveredFieldsSchema,
  type DeliveredFields,
  type WorkRecord,
} from "../types/contracts.js";
import { sha256Uri } from "../utils/hash.js";

export interface LLMRequest {
  agent: string;
  model: string;
  prompt_version: string;
  system: string;
  prompt: string;
  record: WorkRecord;
}

export interface LLMResult {
  response: unknown;
  response_hash: string;
  transcript_hash: string;
  delivered_fields_hash: string | null;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  latency_ms: number;
}

export class LLMProvider {
  constructor(private readonly transcriptDir = "transcripts") {}

  async completeJson(request: LLMRequest): Promise<LLMResult> {
    const started = Date.now();
    const response = env.REPLAY_LLM
      ? this.replayResponse(request)
      : await this.realResponse(request);

    const response_hash = sha256Uri(response);
    const delivered_fields_hash = DeliveredFieldsSchema.safeParse(response).success
      ? sha256Uri(response)
      : null;
    const transcript = {
      agent: request.agent,
      model: request.model,
      prompt_version: request.prompt_version,
      request: {
        system: request.system,
        prompt: request.prompt,
        record_id: request.record.id,
      },
      response,
      response_hash,
      delivered_fields_hash,
    };

    const path = join(this.transcriptDir, `${response_hash.split(":")[1]}.json`);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, `${JSON.stringify(transcript, null, 2)}\n`, "utf8");

    const tokens_in = estimateTokens(request.system) + estimateTokens(request.prompt);
    const tokens_out = estimateTokens(JSON.stringify(response));

    return {
      response,
      response_hash,
      transcript_hash: response_hash,
      delivered_fields_hash,
      tokens_in,
      tokens_out,
      cost_usd: estimateCostUsd(request.model, tokens_in, tokens_out),
      latency_ms: Math.max(1, Date.now() - started),
    };
  }

  private replayResponse(request: LLMRequest): unknown {
    const noteOverride = /real number is\s+(\d+)/i.exec(request.record.notes);
    const amount = noteOverride
      ? Number(noteOverride[1])
      : request.record.amount;

    if (/malformed worker/i.test(request.record.notes) || amount === null) {
      return {
        record_id: request.record.id,
        unsupported: true,
      };
    }

    return {
      case_id: env.CASE_ID,
      record_id: request.record.id,
      owner: request.record.owner,
      deadline: request.record.deadline,
      category: request.record.category,
      amount,
      summary: `${request.record.category} package for ${request.record.owner}: ${request.record.notes}`,
      package_brand: "CEDX Systems",
    } satisfies DeliveredFields;
  }

  private async realResponse(request: LLMRequest): Promise<unknown> {
    const client = new OpenAI({
      apiKey: env.LLM_API_KEY,
      baseURL: env.LLM_BASE_URL,
    });

    const response = await client.responses.create({
      model: request.model,
      input: [
        { role: "system", content: request.system },
        { role: "user", content: request.prompt },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "cedx_delivered_fields",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: [
              "case_id",
              "record_id",
              "owner",
              "deadline",
              "category",
              "amount",
              "summary",
              "package_brand",
            ],
            properties: {
              case_id: { type: "string" },
              record_id: { type: "string" },
              owner: { type: "string" },
              deadline: { type: "string" },
              category: { type: "string" },
              amount: { type: "number" },
              summary: { type: "string" },
              package_brand: { type: "string", enum: ["CEDX Systems"] },
            },
          },
        },
      },
    });

    return JSON.parse(response.output_text);
  }
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function estimateCostUsd(model: string, tokens_in: number, tokens_out: number): number {
  const cheap = model.includes("mini") || model.includes("haiku") || model.includes("flash");
  const inputRate = cheap ? 0.00000015 : 0.0000025;
  const outputRate = cheap ? 0.0000006 : 0.00001;
  return Number((tokens_in * inputRate + tokens_out * outputRate).toFixed(6));
}
