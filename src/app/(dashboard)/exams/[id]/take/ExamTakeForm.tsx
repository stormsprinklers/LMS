"use client";

import { submitExamAttempt } from "@/lib/actions/exams";
import { QuestionTake } from "@/components/exams/QuestionTake";
import { StickyActionBar } from "@/components/ui/StickyActionBar";
import { validateExamAnswers } from "@/lib/exams/validate-answers";
import type { QuestionType } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function ExamTakeForm({
  attemptId,
  examId,
  questions,
  timeLimitMinutes,
}: {
  attemptId: string;
  examId: string;
  questions: {
    id: string;
    type: QuestionType;
    text: string;
    config: unknown;
    options: { id: string; text: string }[];
  }[];
  timeLimitMinutes: number;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setAnswers((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const q of questions) {
        if (q.type === "SLIDER" && next[q.id] === undefined) {
          const cfg = q.config as { min?: number } | null;
          next[q.id] = { value: cfg?.min ?? 0 };
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [questions]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const validation = validateExamAnswers(questions, answers);
    if (!validation.valid) {
      setError(validation.message);
      document
        .getElementById(`question-${validation.questionId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setSubmitting(true);
    try {
      const result = await submitExamAttempt(attemptId, answers);
      if (result?.error) {
        setError(result.error);
        setSubmitting(false);
        return;
      }
      if (result?.pendingReview) {
        router.push(`/exams/${examId}/results?pending=1`);
        return;
      }
      if (result && "score" in result) {
        router.push(
          `/exams/${examId}/results?score=${result.score}&passed=${result.passed}`,
        );
        return;
      }
      setError("Unexpected response from server. Please try again.");
      setSubmitting(false);
    } catch {
      setError("Could not submit the exam. Check your connection and try again.");
      setSubmitting(false);
    }
  }

  if (questions.length === 0) {
    return null;
  }

  return (
    <form
      id="exam-take-form"
      onSubmit={handleSubmit}
      noValidate
      className="mt-6 space-y-6 pb-32 md:pb-8"
    >
      <p className="text-sm text-storm-navy/60">
        Time limit: {timeLimitMinutes} minutes
      </p>
      {questions.map((q, i) => (
        <div key={q.id} id={`question-${q.id}`}>
          <QuestionTake
            question={q}
            index={i}
            value={answers[q.id]}
            onChange={(v) => setAnswers((prev) => ({ ...prev, [q.id]: v }))}
          />
        </div>
      ))}
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </div>
      )}
      <StickyActionBar fixed>
        <button
          type="submit"
          form="exam-take-form"
          disabled={submitting}
          className="min-h-11 w-full rounded-lg bg-storm-medium-blue px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Submit exam"}
        </button>
      </StickyActionBar>
    </form>
  );
}
