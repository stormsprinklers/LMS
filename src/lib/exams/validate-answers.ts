import type { QuestionType } from "@prisma/client";
import type { MatchingConfig } from "./types";

type QuestionForValidation = {
  id: string;
  type: QuestionType;
  text: string;
  config: unknown;
};

export function isQuestionAnswered(
  question: QuestionForValidation,
  answers: Record<string, unknown>,
): boolean {
  const raw = answers[question.id];
  const r =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;

  switch (question.type) {
    case "MULTIPLE_CHOICE": {
      const optionId = r?.optionId;
      return typeof optionId === "string" && optionId.length > 0;
    }
    case "MULTIPLE_SELECT": {
      const ids = r?.optionIds;
      return Array.isArray(ids) && ids.length > 0;
    }
    case "FREE_RESPONSE": {
      return String(r?.text ?? "").trim().length > 0;
    }
    case "SLIDER":
      return true;
    case "MATCHING": {
      const cfg = question.config as MatchingConfig | null;
      const pairs = (r?.pairs as Record<string, string>) ?? {};
      for (const pair of cfg?.pairs ?? []) {
        if (!pairs[pair.left]?.trim()) return false;
      }
      return (cfg?.pairs?.length ?? 0) > 0;
    }
    default:
      return false;
  }
}

export type UnansweredQuestion = { id: string; index: number };

export function getUnansweredQuestions(
  questions: QuestionForValidation[],
  answers: Record<string, unknown>,
): UnansweredQuestion[] {
  return questions
    .map((q, index) => ({ q, index }))
    .filter(({ q }) => !isQuestionAnswered(q, answers))
    .map(({ q, index }) => ({ id: q.id, index }));
}

/** @deprecated Use getUnansweredQuestions; exams may be submitted incomplete after confirmation. */
export function validateExamAnswers(
  questions: QuestionForValidation[],
  answers: Record<string, unknown>,
): { valid: true } | { valid: false; questionId: string; message: string } {
  const unanswered = getUnansweredQuestions(questions, answers);
  if (unanswered.length === 0) return { valid: true };
  const first = unanswered[0];
  return {
    valid: false,
    questionId: first.id,
    message: `Please answer question ${first.index + 1}.`,
  };
}
