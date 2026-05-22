"use client";

import { submitManualGrade } from "@/lib/actions/grading";
import { StickyActionBar } from "@/components/ui/StickyActionBar";
import { useRouter } from "next/navigation";
import { useState } from "react";

const inputClass =
  "mt-1 w-full min-h-11 rounded-lg border border-storm-light-blue/60 px-3 py-2 text-sm";

export function GradeAttemptForm({
  attemptId,
  tasks,
}: {
  attemptId: string;
  tasks: {
    questionId: string;
    questionText: string;
    learnerAnswer: string;
    rubric?: string;
  }[];
}) {
  const router = useRouter();
  const [scores, setScores] = useState<Record<string, number>>({});
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [activeId, setActiveId] = useState(tasks[0]?.questionId ?? "");

  async function grade(questionId: string) {
    const score = scores[questionId] ?? 0;
    await submitManualGrade(attemptId, questionId, score, feedback[questionId]);
    router.refresh();
    router.push("/admin/grading");
  }

  const active = tasks.find((t) => t.questionId === activeId) ?? tasks[0];

  if (!active) return null;

  return (
    <div className="min-w-0 pb-28 md:pb-8">
      {tasks.length > 1 && (
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {tasks.map((t, i) => (
            <button
              key={t.questionId}
              type="button"
              onClick={() => setActiveId(t.questionId)}
              className={`shrink-0 min-h-11 rounded-lg px-3 py-2 text-sm ${
                active.questionId === t.questionId
                  ? "bg-storm-medium-blue text-white"
                  : "bg-storm-light-grey text-storm-navy"
              }`}
            >
              Q{i + 1}
            </button>
          ))}
        </div>
      )}

      <div className="rounded-xl border bg-white p-4 sm:p-5 space-y-4">
        <p className="font-medium text-storm-navy break-words">{active.questionText}</p>
        {active.rubric && (
          <p className="text-sm text-storm-navy/60">Rubric: {active.rubric}</p>
        )}
        <blockquote className="max-h-48 overflow-y-auto rounded-lg bg-storm-light-grey/50 p-3 text-sm break-words">
          {active.learnerAnswer}
        </blockquote>
        <label className="block text-sm">
          Score (0–100)
          <input
            type="number"
            min={0}
            max={100}
            inputMode="numeric"
            value={scores[active.questionId] ?? ""}
            onChange={(e) =>
              setScores((s) => ({ ...s, [active.questionId]: Number(e.target.value) }))
            }
            className={inputClass}
          />
        </label>
        <textarea
          placeholder="Feedback (optional)"
          value={feedback[active.questionId] ?? ""}
          onChange={(e) =>
            setFeedback((f) => ({ ...f, [active.questionId]: e.target.value }))
          }
          className={inputClass}
          rows={3}
        />
      </div>

      <StickyActionBar>
        <button
          type="button"
          onClick={() => grade(active.questionId)}
          className="min-h-11 w-full rounded-lg bg-storm-medium-blue px-4 py-2.5 text-sm font-semibold text-white"
        >
          Submit grade
        </button>
      </StickyActionBar>
    </div>
  );
}
