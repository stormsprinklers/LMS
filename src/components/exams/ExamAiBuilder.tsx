"use client";

import {
  addGeneratedExamQuestions,
  generateExamQuestionsPreview,
} from "@/lib/actions/exam-ai";
import type { RepairedExamQuestion } from "@/lib/ai/repair-exam-questions";
import type { ExamAiQuestionType } from "@/lib/ai/generate-exam-questions";
import { useRouter } from "next/navigation";
import { useState } from "react";

const inputClass =
  "mt-1 w-full min-h-10 rounded-lg border border-storm-light-blue/60 px-3 py-2 text-sm";
const btnPrimary =
  "min-h-11 rounded-lg bg-storm-medium-blue px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50";
const btnSecondary =
  "min-h-11 rounded-lg border border-storm-light-blue/60 bg-white px-4 py-2.5 text-sm font-medium text-storm-navy disabled:opacity-50";

const TYPE_OPTIONS: { value: ExamAiQuestionType; label: string }[] = [
  { value: "MULTIPLE_CHOICE", label: "Multiple choice" },
  { value: "MULTI_SELECT", label: "Select all that apply" },
  { value: "TRUE_FALSE", label: "True / false" },
];

const COUNT_OPTIONS = [3, 5, 8, 10, 15];

function typeLabel(type: ExamAiQuestionType): string {
  return TYPE_OPTIONS.find((t) => t.value === type)?.label ?? type;
}

export function ExamAiBuilder({
  examId,
  examTitle,
  questionCount,
}: {
  examId: string;
  examTitle: string;
  questionCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [count, setCount] = useState(5);
  const [types, setTypes] = useState<ExamAiQuestionType[]>([
    "MULTIPLE_CHOICE",
    "MULTI_SELECT",
    "TRUE_FALSE",
  ]);
  const [preview, setPreview] = useState<RepairedExamQuestion[] | null>(null);
  const [generating, setGenerating] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  function toggleType(value: ExamAiQuestionType) {
    setTypes((prev) =>
      prev.includes(value) ?
        prev.length > 1 ?
          prev.filter((t) => t !== value)
        : prev
      : [...prev, value],
    );
  }

  async function handleGenerate() {
    setGenerating(true);
    setError("");
    setPreview(null);
    const result = await generateExamQuestionsPreview(examId, {
      prompt,
      count,
      types,
    });
    setGenerating(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setPreview(result.questions);
  }

  async function handleAdd(mode: "append" | "replace") {
    if (!preview?.length) return;
    if (
      mode === "replace" &&
      questionCount > 0 &&
      !confirm(
        `Replace all ${questionCount} existing question(s) with these ${preview.length} AI-generated ones?`,
      )
    ) {
      return;
    }
    setAdding(true);
    setError("");
    const result = await addGeneratedExamQuestions(examId, preview, mode);
    setAdding(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setPreview(null);
    setPrompt("");
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-storm-medium-blue/30 bg-storm-medium-blue/5 p-4 sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-medium text-storm-navy">AI question writer</h2>
          <p className="mt-1 text-sm text-storm-navy/70">
            Describe what to test on &ldquo;{examTitle}&rdquo; and generate a batch of
            questions in seconds.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={btnSecondary}
        >
          {open ? "Hide" : "Write with AI"}
        </button>
      </div>

      {open && (
        <div className="mt-4 space-y-4 border-t border-storm-light-blue/40 pt-4">
          <label className="block text-sm">
            <span className="font-medium text-storm-navy">What should learners know?</span>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              placeholder="e.g. Backflow prevention steps, common valve failures, OSHA PPE for trenching…"
              className={inputClass}
            />
          </label>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <label className="block text-sm sm:w-40">
              <span className="font-medium text-storm-navy">How many?</span>
              <select
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className={inputClass}
              >
                {COUNT_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n} questions
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="flex-1 text-sm">
              <legend className="font-medium text-storm-navy">Question types</legend>
              <div className="mt-2 flex flex-wrap gap-3">
                {TYPE_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-storm-light-blue/50 bg-white px-3 py-1.5"
                  >
                    <input
                      type="checkbox"
                      checked={types.includes(opt.value)}
                      onChange={() => toggleType(opt.value)}
                      className="h-4 w-4"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          )}

          <button
            type="button"
            disabled={generating || types.length === 0}
            onClick={handleGenerate}
            className={btnPrimary}
          >
            {generating ? "Generating…" : "Generate preview"}
          </button>

          {preview && preview.length > 0 && (
            <div className="space-y-3 rounded-xl border border-storm-light-blue/50 bg-white p-4">
              <p className="text-sm font-medium text-storm-navy">
                Preview ({preview.length} question{preview.length === 1 ? "" : "s"})
              </p>
              <ol className="max-h-80 space-y-3 overflow-y-auto text-sm text-storm-navy/90">
                {preview.map((q, i) => (
                  <li key={i} className="rounded-lg bg-storm-light-grey/40 px-3 py-2">
                    <p className="font-medium text-storm-navy">
                      {i + 1}. [{typeLabel(q.type)}] {q.text}
                    </p>
                    <ul className="mt-1 list-none pl-0 text-storm-navy/75">
                      {q.options.map((o, oi) => (
                        <li key={oi}>
                          {o.isCorrect ? "✓ " : "○ "}
                          {o.text}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  disabled={adding}
                  onClick={() => handleAdd("append")}
                  className={btnPrimary}
                >
                  {adding ? "Adding…" : `Add to exam (${preview.length})`}
                </button>
                {questionCount > 0 && (
                  <button
                    type="button"
                    disabled={adding}
                    onClick={() => handleAdd("replace")}
                    className={btnSecondary}
                  >
                    Replace all questions
                  </button>
                )}
                <button
                  type="button"
                  disabled={generating}
                  onClick={handleGenerate}
                  className={btnSecondary}
                >
                  Regenerate
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
