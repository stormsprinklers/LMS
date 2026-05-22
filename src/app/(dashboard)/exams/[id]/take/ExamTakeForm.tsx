"use client";

import { saveExamProgress, submitExamAttempt } from "@/lib/actions/exams";
import { QuestionTake } from "@/components/exams/QuestionTake";
import { StickyActionBar } from "@/components/ui/StickyActionBar";
import { getUnansweredQuestions } from "@/lib/exams/validate-answers";
import type { QuestionType } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type Question = {
  id: string;
  type: QuestionType;
  text: string;
  config: unknown;
  options: { id: string; text: string }[];
};

function buildInitialAnswers(
  questions: Question[],
  saved: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...saved };
  for (const q of questions) {
    if (q.type === "SLIDER" && next[q.id] === undefined) {
      const cfg = q.config as { min?: number } | null;
      next[q.id] = { value: cfg?.min ?? 0 };
    }
  }
  return next;
}

function formatSavedTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function ExamTakeForm({
  attemptId,
  examId,
  questions,
  timeLimitMinutes,
  initialAnswers = {},
}: {
  attemptId: string;
  examId: string;
  questions: Question[];
  timeLimitMinutes: number;
  initialAnswers?: Record<string, unknown>;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState(() =>
    buildInitialAnswers(questions, initialAnswers),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [highlightUnanswered, setHighlightUnanswered] = useState<Set<string>>(
    new Set(),
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [unansweredCount, setUnansweredCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const skipAutosaveRef = useRef(true);
  const saveInFlightRef = useRef(false);

  const persistProgress = useCallback(
    async (showSaving = true) => {
      if (saveInFlightRef.current) return;
      saveInFlightRef.current = true;
      if (showSaving) setSaving(true);
      setSaveError("");
      try {
        const result = await saveExamProgress(attemptId, answers);
        if (result?.error) {
          setSaveError(result.error);
          return;
        }
        if (result?.savedAt) setLastSavedAt(result.savedAt);
      } catch {
        setSaveError("Could not save progress. Check your connection.");
      } finally {
        saveInFlightRef.current = false;
        if (showSaving) setSaving(false);
      }
    },
    [attemptId, answers],
  );

  useEffect(() => {
    if (skipAutosaveRef.current) {
      skipAutosaveRef.current = false;
      return;
    }
    const timer = setTimeout(() => {
      void persistProgress(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, [answers, persistProgress]);

  async function handleSaveProgress() {
    await persistProgress(true);
  }

  async function submitToServer() {
    setSubmitting(true);
    setError("");
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const unanswered = getUnansweredQuestions(questions, answers);
    if (unanswered.length > 0) {
      setHighlightUnanswered(new Set(unanswered.map((u) => u.id)));
      setUnansweredCount(unanswered.length);
      setConfirmOpen(true);
      scrollToQuestion(unanswered[0].id);
      return;
    }

    void submitToServer();
  }

  function scrollToQuestion(questionId: string) {
    document
      .getElementById(`question-${questionId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function handleAnswerChange(questionId: string, value: unknown) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    setHighlightUnanswered((prev) => {
      if (!prev.has(questionId)) return prev;
      const next = new Set(prev);
      next.delete(questionId);
      return next;
    });
  }

  if (questions.length === 0) {
    return null;
  }

  const highlightedCount = highlightUnanswered.size;
  const saveStatus = saving
    ? "Saving…"
    : saveError
      ? saveError
      : lastSavedAt
        ? `Saved at ${formatSavedTime(lastSavedAt)}`
        : "Autosaves as you answer";

  return (
    <>
      <form
        id="exam-take-form"
        onSubmit={handleSubmit}
        noValidate
        className="mt-6 space-y-6 pb-32 md:pb-8"
      >
        <p className="text-sm text-storm-navy/60">
          Time limit: {timeLimitMinutes} minutes
          {highlightedCount > 0 && (
            <span className="ml-2 font-medium text-amber-800">
              · {highlightedCount} question{highlightedCount === 1 ? "" : "s"}{" "}
              not answered
            </span>
          )}
        </p>
        {questions.map((q, i) => (
          <div key={q.id} id={`question-${q.id}`}>
            <QuestionTake
              question={q}
              index={i}
              value={answers[q.id]}
              onChange={(v) => handleAnswerChange(q.id, v)}
              unanswered={highlightUnanswered.has(q.id)}
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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
              <button
                type="button"
                onClick={() => void handleSaveProgress()}
                disabled={saving || submitting}
                className="min-h-11 rounded-lg border border-storm-medium-blue px-4 py-2.5 text-sm font-semibold text-storm-medium-blue disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save progress"}
              </button>
              <span
                className={`text-xs ${saveError ? "text-red-700" : "text-storm-navy/60"}`}
                aria-live="polite"
              >
                {saveStatus}
              </span>
            </div>
            <button
              type="submit"
              form="exam-take-form"
              disabled={submitting || saving}
              className="min-h-11 w-full rounded-lg bg-storm-medium-blue px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-50 sm:w-auto"
            >
              {submitting ? "Submitting…" : "Submit exam"}
            </button>
          </div>
        </StickyActionBar>
      </form>

      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="submit-incomplete-title"
        >
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2
              id="submit-incomplete-title"
              className="font-title text-lg font-bold text-storm-navy"
            >
              Submit incomplete exam?
            </h2>
            <p className="mt-3 text-sm text-storm-navy/80">
              You have{" "}
              <strong>
                {unansweredCount} question{unansweredCount === 1 ? "" : "s"} left
              </strong>{" "}
              without an answer. Unanswered questions are highlighted below. Do you
              really want to submit without answering them?
            </p>
            <ul className="mt-3 max-h-40 overflow-y-auto text-sm text-amber-900">
              {getUnansweredQuestions(questions, answers).map((u) => (
                <li key={u.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmOpen(false);
                      scrollToQuestion(u.id);
                    }}
                    className="w-full py-1 text-left font-medium underline"
                  >
                    Question {u.index + 1}
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
              <button
                type="button"
                disabled={submitting}
                onClick={() => {
                  setConfirmOpen(false);
                  void submitToServer();
                }}
                className="min-h-11 flex-1 rounded-lg bg-storm-medium-blue px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {submitting ? "Submitting…" : "Yes, submit anyway"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="min-h-11 flex-1 rounded-lg border border-storm-light-blue/60 px-4 py-2.5 text-sm font-medium text-storm-navy"
              >
                Go back and answer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
