"use client";

import { saveAttemptGrades } from "@/lib/actions/grading";
import type { GradingQuestionRow } from "@/lib/actions/grading";
import { StickyActionBar } from "@/components/ui/StickyActionBar";
import { useRouter } from "next/navigation";
import { useState } from "react";

const inputClass =
  "mt-1 w-full min-h-11 rounded-lg border border-storm-light-blue/60 px-3 py-2 text-sm";

const TYPE_LABELS: Record<string, string> = {
  MULTIPLE_CHOICE: "Multiple choice",
  MULTIPLE_SELECT: "Select all that apply",
  FREE_RESPONSE: "Free response",
  SLIDER: "Slider",
  MATCHING: "Matching",
};

export function GradeAttemptForm({
  attemptId,
  questions,
  pendingManualCount,
}: {
  attemptId: string;
  questions: GradingQuestionRow[];
  pendingManualCount: number;
}) {
  const router = useRouter();
  const [scores, setScores] = useState<Record<string, number>>(() =>
    Object.fromEntries(questions.map((q) => [q.questionId, q.initialScore])),
  );
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const grades = questions.map((q) => ({
        questionId: q.questionId,
        score: scores[q.questionId] ?? q.initialScore,
        feedback: feedback[q.questionId],
      }));
      const result = await saveAttemptGrades(attemptId, grades);
      if (result?.error) {
        setError(result.error);
        setSaving(false);
        return;
      }
      router.push("/admin/grading");
      router.refresh();
    } catch {
      setError("Could not save grades. Please try again.");
      setSaving(false);
    }
  }

  if (questions.length === 0) return null;

  return (
    <div className="min-w-0 pb-32 md:pb-8">
      <p className="mb-4 text-sm text-storm-navy/70">
        Review all {questions.length} question{questions.length === 1 ? "" : "s"} below.
        {pendingManualCount > 0 && (
          <>
            {" "}
            <strong>{pendingManualCount}</strong> free-response
            {pendingManualCount === 1 ? "" : "s"} need your score; auto-graded questions
            can be adjusted if needed.
          </>
        )}
      </p>

      <div className="space-y-6">
        {questions.map((q) => (
          <section
            key={q.questionId}
            id={`grade-question-${q.questionId}`}
            className={`rounded-xl border bg-white p-4 sm:p-5 ${
              q.needsManual ? "border-storm-medium-blue/40" : ""
            }`}
          >
            <div className="flex flex-wrap items-center gap-2 text-xs text-storm-navy/60">
              <span className="font-semibold text-storm-navy">
                Question {q.index + 1}
              </span>
              <span className="rounded bg-storm-light-grey px-2 py-0.5">
                {TYPE_LABELS[q.type] ?? q.type}
              </span>
              {q.needsManual ? (
                <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-900">
                  Needs review
                </span>
              ) : q.autoScore !== null ? (
                <span>Auto-scored: {q.autoScore}%</span>
              ) : null}
            </div>
            <p className="mt-3 font-medium text-storm-navy break-words">
              {q.questionText}
            </p>
            {q.rubric && (
              <p className="mt-2 text-sm text-storm-navy/60">
                <span className="font-medium">Rubric:</span> {q.rubric}
              </p>
            )}
            <div className="mt-3">
              <p className="text-xs font-medium uppercase tracking-wide text-storm-navy/50">
                Learner answer
              </p>
              <blockquote className="mt-1 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg bg-storm-light-grey/50 p-3 text-sm break-words">
                {q.learnerAnswer}
              </blockquote>
            </div>
            <label className="mt-4 block text-sm">
              Score (0–100)
              <input
                type="number"
                min={0}
                max={100}
                inputMode="numeric"
                value={scores[q.questionId] ?? ""}
                onChange={(e) =>
                  setScores((s) => ({
                    ...s,
                    [q.questionId]: Number(e.target.value),
                  }))
                }
                className={inputClass}
              />
            </label>
            <textarea
              placeholder="Feedback for learner (optional)"
              value={feedback[q.questionId] ?? ""}
              onChange={(e) =>
                setFeedback((f) => ({
                  ...f,
                  [q.questionId]: e.target.value,
                }))
              }
              className={inputClass}
              rows={2}
            />
          </section>
        ))}
      </div>

      {error && (
        <p role="alert" className="mt-4 text-sm text-red-600">
          {error}
        </p>
      )}

      <StickyActionBar fixed>
        <button
          type="button"
          disabled={saving}
          onClick={() => void handleSave()}
          className="min-h-11 w-full rounded-lg bg-storm-medium-blue px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save grades"}
        </button>
      </StickyActionBar>
    </div>
  );
}
