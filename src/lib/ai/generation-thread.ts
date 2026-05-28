export type GenerationChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export function parseGenerationMessages(raw: unknown): GenerationChatMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (m): m is GenerationChatMessage =>
      !!m &&
      typeof m === "object" &&
      (m as GenerationChatMessage).role !== undefined &&
      typeof (m as GenerationChatMessage).content === "string",
  );
}
