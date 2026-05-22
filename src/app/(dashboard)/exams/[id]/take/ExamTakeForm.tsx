"use client";

import { submitExamAttempt } from "@/lib/actions/exams";
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
  questions: { id: string; text: string; options: { id: string; text: string }[] }[];
  timeLimitMinutes: number;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const result = await submitExamAttempt(attemptId, answers);
    setSubmitting(false);
    if (result.error) return;
    router.push(`/exams/${examId}/results?score=${result.score}&passed=${result.passed}`);
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-8">
      <p className="text-sm text-storm-navy/60">
        Time limit: {timeLimitMinutes} minutes
      </p>
      {questions.map((q, i) => (
        <fieldset key={q.id} className="rounded-xl border border-storm-light-blue/60 bg-white p-5">
          <legend className="font-medium text-storm-navy">
            {i + 1}. {q.text}
          </legend>
          <div className="mt-4 space-y-2">
            {q.options.map((o) => (
              <label
                key={o.id}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-transparent px-3 py-2 hover:bg-storm-light-grey/50"
              >
                <input
                  type="radio"
                  name={q.id}
                  value={o.id}
                  required
                  onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: o.id }))}
                />
                <span className="text-sm text-storm-navy">{o.text}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-storm-medium-blue px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {submitting ? "Submitting…" : "Submit exam"}
      </button>
    </form>
  );
}
