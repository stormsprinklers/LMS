import OpenAI from "openai";

export function getOpenAIClient(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;
  return new OpenAI({ apiKey: key });
}

export function requireOpenAI(): OpenAI {
  const client = getOpenAIClient();
  if (!client) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }
  return client;
}

export const AI_GENERATION_MODEL =
  process.env.OPENAI_COURSE_MODEL?.trim() || "gpt-4o-mini";

/** Max completion tokens for structure generation (keeps TPM headroom on tier-1 orgs). */
export const AI_STRUCTURE_MAX_TOKENS = 4_096;

/** Max completion tokens for per-item content generation. */
export const AI_ITEM_CONTENT_MAX_TOKENS = 8_192;

export const AI_SUMMARY_MODEL =
  process.env.OPENAI_SUMMARY_MODEL?.trim() || "gpt-4o-mini";
