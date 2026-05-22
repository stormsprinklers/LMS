import type { Exam, Question, AnswerOption } from "@prisma/client";
import type { AnswerValue } from "./types";
import type {
  MatchingConfig,
  SliderConfig,
} from "./types";

type QuestionWithOptions = Question & { options: AnswerOption[] };

export function gradeAnswer(
  question: QuestionWithOptions,
  value: AnswerValue,
): { autoScore: number | null; needsManual: boolean } {
  switch (question.type) {
    case "MULTIPLE_CHOICE": {
      if (value.kind !== "option") return { autoScore: 0, needsManual: false };
      const correct = question.options.find((o) => o.isCorrect);
      return {
        autoScore: correct && value.optionId === correct.id ? 100 : 0,
        needsManual: false,
      };
    }
    case "MULTIPLE_SELECT": {
      if (value.kind !== "options") return { autoScore: 0, needsManual: false };
      const correctIds = new Set(
        question.options.filter((o) => o.isCorrect).map((o) => o.id),
      );
      const selected = new Set(value.optionIds);
      if (correctIds.size !== selected.size) {
        return { autoScore: 0, needsManual: false };
      }
      for (const id of correctIds) {
        if (!selected.has(id)) return { autoScore: 0, needsManual: false };
      }
      return { autoScore: 100, needsManual: false };
    }
    case "SLIDER": {
      if (value.kind !== "slider") return { autoScore: 0, needsManual: false };
      const cfg = question.config as SliderConfig | null;
      if (!cfg) return { autoScore: 0, needsManual: false };
      const tol = cfg.tolerance ?? 0;
      const diff = Math.abs(value.value - cfg.correctValue);
      return {
        autoScore: diff <= tol ? 100 : 0,
        needsManual: false,
      };
    }
    case "MATCHING": {
      if (value.kind !== "matching") return { autoScore: 0, needsManual: false };
      const cfg = question.config as MatchingConfig | null;
      if (!cfg?.pairs?.length) return { autoScore: 0, needsManual: false };
      let correct = 0;
      for (const pair of cfg.pairs) {
        if (value.pairs[pair.left] === pair.right) correct++;
      }
      const pct = Math.round((correct / cfg.pairs.length) * 100);
      return { autoScore: pct, needsManual: false };
    }
    case "FREE_RESPONSE":
      return { autoScore: null, needsManual: true };
    default:
      return { autoScore: 0, needsManual: false };
  }
}

export function computeAttemptScore(
  answers: { autoScore: number | null; manualScore: number | null }[],
): number {
  if (answers.length === 0) return 0;
  let total = 0;
  let count = 0;
  for (const a of answers) {
    const s = a.manualScore ?? a.autoScore;
    if (s !== null && s !== undefined) {
      total += s;
      count++;
    }
  }
  return count > 0 ? Math.round(total / count) : 0;
}

export function parseSubmittedAnswer(
  question: QuestionWithOptions,
  raw: unknown,
): AnswerValue {
  if (!raw || typeof raw !== "object") {
    return { kind: "text", text: "" };
  }
  const r = raw as Record<string, unknown>;
  switch (question.type) {
    case "MULTIPLE_CHOICE":
      return { kind: "option", optionId: String(r.optionId ?? "") };
    case "MULTIPLE_SELECT":
      return {
        kind: "options",
        optionIds: Array.isArray(r.optionIds)
          ? r.optionIds.map(String)
          : [],
      };
    case "FREE_RESPONSE":
      return { kind: "text", text: String(r.text ?? "") };
    case "SLIDER":
      return { kind: "slider", value: Number(r.value ?? 0) };
    case "MATCHING":
      return {
        kind: "matching",
        pairs: (r.pairs as Record<string, string>) ?? {},
      };
    default:
      return { kind: "text", text: "" };
  }
}

export async function finalizeAttemptScore(
  exam: Exam,
  answerRows: { autoScore: number | null; manualScore: number | null }[],
) {
  const score = computeAttemptScore(answerRows);
  const passed = score >= exam.passingScore;
  return { score, passed };
}
