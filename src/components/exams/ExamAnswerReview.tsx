import type { AnswerOption, Question } from "@prisma/client";
import { formatLearnerAnswerForGrading } from "@/lib/exams/format-answer";
import { parseSubmittedAnswer } from "@/lib/exams/grade-attempt";
import type { MatchingConfig, SliderConfig } from "@/lib/exams/types";

type QuestionWithOptions = Question & { options: AnswerOption[] };

type ExamAnswerReviewProps = {
  question: QuestionWithOptions;
  value: unknown;
  autoScore: number | null;
  manualScore: number | null;
  feedback: string | null;
};

function scoreOf(autoScore: number | null, manualScore: number | null) {
  return manualScore ?? autoScore;
}

function isCorrectScore(score: number | null) {
  return score !== null && score >= 100;
}

function selectedOptionIds(question: QuestionWithOptions, value: unknown): Set<string> {
  const parsed = parseSubmittedAnswer(question, value);
  if (parsed.kind === "option") return new Set(parsed.optionId ? [parsed.optionId] : []);
  if (parsed.kind === "options") return new Set(parsed.optionIds);
  return new Set();
}

function OptionRow({
  text,
  selected,
  correct,
}: {
  text: string;
  selected: boolean;
  correct: boolean;
}) {
  let border = "border-storm-light-blue/40 bg-white";
  let badge = "";
  if (correct && selected) {
    border = "border-emerald-500 bg-emerald-50";
    badge = "Your answer · Correct";
  } else if (correct) {
    border = "border-emerald-500 bg-emerald-50/70";
    badge = "Correct answer";
  } else if (selected) {
    border = "border-red-500 bg-red-50";
    badge = "Your answer";
  }

  return (
    <li className={`rounded-md border px-3 py-2 text-sm ${border}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <span className="text-storm-navy">{text}</span>
        {badge ? (
          <span
            className={`shrink-0 text-xs font-semibold ${
              correct ? "text-emerald-700" : "text-red-700"
            }`}
          >
            {badge}
          </span>
        ) : null}
      </div>
    </li>
  );
}

function NonOptionReview({
  question,
  value,
  correct,
}: {
  question: QuestionWithOptions;
  value: unknown;
  correct: boolean | null;
}) {
  const yourAnswer = formatLearnerAnswerForGrading(question, value);
  let correctAnswer = "—";

  if (question.type === "SLIDER") {
    const cfg = question.config as SliderConfig | null;
    correctAnswer =
      cfg?.correctValue != null
        ? `${cfg.correctValue}${cfg.tolerance ? ` (±${cfg.tolerance})` : ""}`
        : "—";
  } else if (question.type === "MATCHING") {
    const cfg = question.config as MatchingConfig | null;
    correctAnswer = cfg?.pairs?.length
      ? cfg.pairs.map((p) => `${p.left} → ${p.right}`).join("; ")
      : "—";
  } else if (question.type === "FREE_RESPONSE") {
    correctAnswer = "Graded by instructor";
  }

  return (
    <div className="mt-3 space-y-2 text-sm">
      <div
        className={`rounded-md border px-3 py-2 ${
          correct === true
            ? "border-emerald-500 bg-emerald-50"
            : correct === false
              ? "border-red-500 bg-red-50"
              : "border-storm-light-blue/40 bg-storm-light-grey/30"
        }`}
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-storm-navy/55">
          Your answer
        </p>
        <p className="mt-1 whitespace-pre-wrap text-storm-navy">{yourAnswer}</p>
      </div>
      <div className="rounded-md border border-emerald-500/70 bg-emerald-50/60 px-3 py-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800/80">
          Correct answer
        </p>
        <p className="mt-1 whitespace-pre-wrap text-storm-navy">{correctAnswer}</p>
      </div>
    </div>
  );
}

export function ExamAnswerReview({
  question,
  value,
  autoScore,
  manualScore,
  feedback,
}: ExamAnswerReviewProps) {
  const score = scoreOf(autoScore, manualScore);
  const hasScore = score !== null;
  const correct = hasScore ? isCorrectScore(score) : null;
  const isOptionQuestion =
    question.type === "MULTIPLE_CHOICE" || question.type === "MULTIPLE_SELECT";
  const selected = selectedOptionIds(question, value);

  const cardBorder =
    correct === true
      ? "border-emerald-500"
      : correct === false
        ? "border-red-500"
        : "border-storm-light-blue/50";

  const statusLabel =
    correct === true ? "Correct" : correct === false ? "Incorrect" : "Pending review";
  const statusColor =
    correct === true
      ? "text-emerald-700"
      : correct === false
        ? "text-red-700"
        : "text-amber-800";

  return (
    <li className={`rounded-lg border-2 p-4 text-sm ${cardBorder}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="font-medium text-storm-navy">{question.text}</p>
        <span className={`text-xs font-bold uppercase tracking-wide ${statusColor}`}>
          {statusLabel}
        </span>
      </div>

      {isOptionQuestion ? (
        <ul className="mt-3 space-y-2">
          {question.options
            .slice()
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((opt) => (
              <OptionRow
                key={opt.id}
                text={opt.text}
                selected={selected.has(opt.id)}
                correct={opt.isCorrect}
              />
            ))}
        </ul>
      ) : (
        <NonOptionReview question={question} value={value} correct={correct} />
      )}

      {feedback ? (
        <p className="mt-3 text-storm-navy/70">Feedback: {feedback}</p>
      ) : null}
      <p className="mt-2 text-xs text-storm-navy/55">
        Points: {score !== null ? `${score}%` : "—"}
      </p>
    </li>
  );
}
