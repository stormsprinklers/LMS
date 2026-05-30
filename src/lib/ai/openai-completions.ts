import type OpenAI from "openai";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const status = (error as { status?: number }).status;
  if (status === 429) return true;
  const message = (error as { message?: string }).message ?? "";
  return message.includes("429") || message.toLowerCase().includes("rate limit");
}

function retryDelayMs(error: unknown, attempt: number): number {
  const headers = (error as { headers?: { get?: (name: string) => string | null } })
    .headers;
  const retryAfter = headers?.get?.("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (!Number.isNaN(seconds) && seconds > 0) {
      return Math.min(seconds * 1000, 60_000);
    }
  }
  return Math.min(2000 * 2 ** attempt, 30_000);
}

/** Retry OpenAI chat completions on 429 / TPM rate limits. */
export async function createChatCompletionWithRetry(
  openai: OpenAI,
  params: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming,
  maxRetries = 3,
): Promise<OpenAI.Chat.ChatCompletion> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await openai.chat.completions.create(params);
    } catch (error) {
      lastError = error;
      if (!isRateLimitError(error) || attempt >= maxRetries) {
        throw error;
      }
      await sleep(retryDelayMs(error, attempt));
    }
  }
  throw lastError;
}
