export function parseSavedExamAnswers(raw: unknown): Record<string, unknown> {
  if (raw === null || raw === undefined) return {};
  if (typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof key === "string") out[key] = value;
  }
  return out;
}

export function hasSavedExamAnswers(answers: Record<string, unknown>): boolean {
  return Object.keys(answers).length > 0;
}
