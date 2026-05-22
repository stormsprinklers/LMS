import type { Question, AnswerOption } from "@prisma/client";
import { parseSubmittedAnswer } from "./grade-attempt";

type QuestionWithOptions = Question & { options: AnswerOption[] };

export function formatLearnerAnswerForGrading(
  question: QuestionWithOptions,
  raw: unknown,
): string {
  const parsed = parseSubmittedAnswer(question, raw);

  switch (parsed.kind) {
    case "option": {
      const opt = question.options.find((o) => o.id === parsed.optionId);
      return opt?.text ?? "(no selection)";
    }
    case "options": {
      if (parsed.optionIds.length === 0) return "(none selected)";
      const labels = parsed.optionIds
        .map((id) => question.options.find((o) => o.id === id)?.text)
        .filter(Boolean);
      return labels.length > 0 ? labels.join(", ") : "(none selected)";
    }
    case "text":
      return parsed.text.trim() || "(empty response)";
    case "slider":
      return String(parsed.value);
    case "matching": {
      const entries = Object.entries(parsed.pairs);
      if (entries.length === 0) return "(no matches)";
      return entries.map(([left, right]) => `${left} → ${right}`).join("\n");
    }
    default:
      return "(no answer)";
  }
}
