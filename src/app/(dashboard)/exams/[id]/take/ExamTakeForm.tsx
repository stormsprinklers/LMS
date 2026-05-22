"use client";

import { submitExamAttempt } from "@/lib/actions/exams";
import { QuestionTake } from "@/components/exams/QuestionTake";
import { StickyActionBar } from "@/components/ui/StickyActionBar";
import type { QuestionType } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const result = await submitExamAttempt(attemptId, answers);
    setSubmitting(false);
    if (result.error) return;
    if (result.pendingReview) {
      router.push(`/exams/${examId}/results?pending=1`);
      return;
    }
    router.push(`/exams/${examId}/results?score=${result.score}&passed=${result.passed}`);
  }

  if (questions.length === 0) {
    return null;
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-6 pb-24 md:pb-8">
      <p className="text-sm text-storm-navy/60">
        Time limit: {timeLimitMinutes} minutes
      </p>
      {questions.map((q, i) => (
        <QuestionTake
          key={q.id}
          question={q}
          index={i}
          value={answers[q.id]}
          onChange={(v) => setAnswers((prev) => ({ ...prev, [q.id]: v }))}
        />
      ))}
      <StickyActionBar>
        <button
          type="submit"
          disabled={submitting}
          className="min-h-11 w-full rounded-lg bg-storm-medium-blue px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Submit exam"}
        </button>
      </StickyActionBar>
    </form>
  );
}
