import type { QuestionType } from "@prisma/client";
import type { MatchingConfig } from "./types";

type QuestionForValidation = {
  id: string;
  type: QuestionType;
  text: string;
  config: unknown;
};

export function validateExamAnswers(
  questions: QuestionForValidation[],
  answers: Record<string, unknown>,
): { valid: true } | { valid: false; questionId: string; message: string } {
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const raw = answers[q.id];
    const r =
      raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;

    switch (q.type) {
      case "MULTIPLE_CHOICE": {
        const optionId = r?.optionId;
        if (typeof optionId !== "string" || !optionId) {
          return {
            valid: false,
            questionId: q.id,
            message: `Please select an answer for question ${i + 1}.`,
          };
        }
        break;
      }
      case "MULTIPLE_SELECT": {
        const ids = r?.optionIds;
        if (!Array.isArray(ids) || ids.length === 0) {
          return {
            valid: false,
            questionId: q.id,
            message: `Please select at least one option for question ${i + 1}.`,
          };
        }
        break;
      }
      case "FREE_RESPONSE": {
        const text = String(r?.text ?? "").trim();
        if (!text) {
          return {
            valid: false,
            questionId: q.id,
            message: `Please enter a response for question ${i + 1}.`,
          };
        }
        break;
      }
      case "SLIDER":
        break;
      case "MATCHING": {
        const cfg = q.config as MatchingConfig | null;
        const pairs = (r?.pairs as Record<string, string>) ?? {};
        for (const pair of cfg?.pairs ?? []) {
          if (!pairs[pair.left]?.trim()) {
            return {
              valid: false,
              questionId: q.id,
              message: `Please complete all matches for question ${i + 1}.`,
            };
          }
        }
        break;
      }
    }
  }
  return { valid: true };
}
