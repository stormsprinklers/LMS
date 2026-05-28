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
  process.env.OPENAI_COURSE_MODEL?.trim() || "gpt-4o";

export const AI_SUMMARY_MODEL =
  process.env.OPENAI_SUMMARY_MODEL?.trim() || "gpt-4o-mini";
