import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const EnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  PORT: z.coerce.number().default(3000),

  MAX_COST_USD_PER_RECORD: z.coerce.number().default(0.05),

  MAX_STEPS_PER_RECORD: z.coerce.number().default(10),

  DATABASE_URL: z.string(),

  SEED_DIR: z.string().default("seed"),

  REPLAY_LLM: z.coerce.boolean().default(true),

  LLM_API_KEY: z.string().optional(),

  LLM_MODEL: z.string().default("gpt-4o-mini"),

  LLM_BASE_URL: z.string().optional(),

  CASE_ID: z.string().default("CEDX-XXXX"),

  PIPELINE_NOW: z.string().default("2026-06-26"),
});

export const env = EnvSchema.parse(process.env);
