"use client";

import { addQuestion, updateQuestion } from "@/lib/actions/exams-admin";
import type { MatchingConfig, SliderConfig, FreeResponseConfig } from "@/lib/exams/types";
import type { QuestionType } from "@prisma/client";
import { useState } from "react";

const TYPES: { value: QuestionType; label: string }[] = [
  { value: "MULTIPLE_CHOICE", label: "Multiple choice" },
  { value: "MULTIPLE_SELECT", label: "Select all that apply" },
  { value: "FREE_RESPONSE", label: "Free response" },
  { value: "SLIDER", label: "Slider" },
  { value: "MATCHING", label: "Matching" },
];

type OptionRow = { id?: string; text: string; isCorrect: boolean };

export type EditableQuestion = {
  id: string;
  type: QuestionType;
  text: string;
  sortOrder: number;
  config: unknown;
  options: { id: string; text: string; isCorrect: boolean }[];
};

const DEFAULT_OPTIONS: OptionRow[] = [
  { text: "", isCorrect: true },
  { text: "", isCorrect: false },
  { text: "", isCorrect: false },
  { text: "", isCorrect: false },
];

function initialOptionsFromQuestion(question?: EditableQuestion): OptionRow[] {
  if (!question?.options.length) return DEFAULT_OPTIONS;
  const rows = question.options.map((o) => ({
    id: o.id,
    text: o.text,
    isCorrect: o.isCorrect,
  }));
  return rows.length >= 2 ? rows : [...rows, { text: "", isCorrect: false }];
}

function initialSlider(question?: EditableQuestion) {
  const cfg = question?.config as SliderConfig | null;
  return {
    min: cfg?.min ?? 0,
    max: cfg?.max ?? 100,
    correct: cfg?.correctValue ?? 50,
    tolerance: cfg?.tolerance ?? 2,
  };
}

function initialPairs(question?: EditableQuestion) {
  const cfg = question?.config as MatchingConfig | null;
  const pairs = cfg?.pairs?.filter((p) => p.left || p.right) ?? [];
  return pairs.length >= 2
    ? pairs
    : [
        { left: "", right: "" },
        { left: "", right: "" },
      ];
}

function initialFreeResponse(question?: EditableQuestion) {
  const cfg = question?.config as FreeResponseConfig | null;
  return {
    maxLength: cfg?.maxLength != null ? String(cfg.maxLength) : "",
    rubric: cfg?.rubric ?? "",
  };
}

export function QuestionEditor({
  examId,
  nextSortOrder,
  question,
  onCancel,
  onSaved,
}: {
  examId: string;
  nextSortOrder: number;
  question?: EditableQuestion;
  onCancel?: () => void;
  onSaved?: () => void;
}) {
  const isEdit = !!question;

  const [type, setType] = useState<QuestionType>(
    question?.type ?? "MULTIPLE_CHOICE",
  );
  const [text, setText] = useState(question?.text ?? "");
  const [options, setOptions] = useState<OptionRow[]>(() =>
    initialOptionsFromQuestion(question),
  );
  const [slider, setSlider] = useState(() => initialSlider(question));
  const [pairs, setPairs] = useState(() => initialPairs(question));
  const [freeResponse, setFreeResponse] = useState(() =>
    initialFreeResponse(question),
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function resetAddForm() {
    setText("");
    setType("MULTIPLE_CHOICE");
    setOptions(DEFAULT_OPTIONS);
    setSlider({ min: 0, max: 100, correct: 50, tolerance: 2 });
    setPairs([
      { left: "", right: "" },
      { left: "", right: "" },
    ]);
    setFreeResponse({ maxLength: "", rubric: "" });
  }

  function buildInput() {
    const sortOrder = isEdit ? question.sortOrder : nextSortOrder;

    if (type === "MULTIPLE_CHOICE" || type === "MULTIPLE_SELECT") {
      const opts = options.filter((o) => o.text.trim());
      return {
        type,
        text,
        sortOrder,
        options: opts.map((o) => ({
          id: o.id,
          text: o.text,
          isCorrect: o.isCorrect,
        })),
      };
    }
    if (type === "FREE_RESPONSE") {
      return {
        type,
        text,
        sortOrder,
        config: {
          maxLength: freeResponse.maxLength
            ? parseInt(freeResponse.maxLength, 10)
            : undefined,
          rubric: freeResponse.rubric || undefined,
        },
      };
    }
    if (type === "SLIDER") {
      return {
        type,
        text,
        sortOrder,
        config: {
          min: slider.min,
          max: slider.max,
          step: 1,
          correctValue: slider.correct,
          tolerance: slider.tolerance,
        },
      };
    }
    return {
      type: "MATCHING" as const,
      text,
      sortOrder,
      config: { pairs: pairs.filter((p) => p.left && p.right) },
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const input = buildInput();
      if (isEdit) {
        await updateQuestion(examId, question.id, input);
      } else {
        await addQuestion(examId, input);
        resetAddForm();
      }
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    }
    setSaving(false);
  }

  const inputClass =
    "w-full min-h-11 rounded-lg border border-storm-light-blue/60 px-3 py-2 text-sm";

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full rounded-xl border bg-white p-4 sm:p-5 space-y-4"
    >
      <h3 className="font-medium text-storm-navy">
        {isEdit ? "Edit question" : "Add question"}
      </h3>
      <select
        value={type}
        onChange={(e) => setType(e.target.value as QuestionType)}
        className={inputClass}
      >
        {TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        required
        placeholder="Question text"
        className={inputClass}
        rows={2}
      />

      {(type === "MULTIPLE_CHOICE" || type === "MULTIPLE_SELECT") && (
        <div className="space-y-2">
          {options.map((o, i) => (
            <div key={o.id ?? `new-${i}`} className="flex min-h-11 items-center gap-3">
              <input
                type={type === "MULTIPLE_CHOICE" ? "radio" : "checkbox"}
                name={isEdit ? `correct-${question.id}` : "correct"}
                className="h-5 w-5 shrink-0"
                checked={o.isCorrect}
                onChange={() => {
                  if (type === "MULTIPLE_CHOICE") {
                    setOptions((prev) =>
                      prev.map((p, j) => ({ ...p, isCorrect: j === i })),
                    );
                  } else {
                    setOptions((prev) =>
                      prev.map((p, j) =>
                        j === i ? { ...p, isCorrect: !p.isCorrect } : p,
                      ),
                    );
                  }
                }}
              />
              <input
                value={o.text}
                onChange={(e) =>
                  setOptions((prev) =>
                    prev.map((p, j) =>
                      j === i ? { ...p, text: e.target.value } : p,
                    ),
                  )
                }
                placeholder={`Option ${String.fromCharCode(65 + i)}`}
                className={`flex-1 ${inputClass}`}
              />
              {options.length > 2 && (
                <button
                  type="button"
                  onClick={() =>
                    setOptions((prev) => prev.filter((_, j) => j !== i))
                  }
                  className="shrink-0 text-sm text-red-600"
                  aria-label={`Remove option ${i + 1}`}
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              setOptions((prev) => [...prev, { text: "", isCorrect: false }])
            }
            className="min-h-11 text-sm text-storm-medium-blue"
          >
            + Add option
          </button>
        </div>
      )}

      {type === "FREE_RESPONSE" && (
        <>
          <input
            type="number"
            value={freeResponse.maxLength}
            onChange={(e) =>
              setFreeResponse((prev) => ({ ...prev, maxLength: e.target.value }))
            }
            placeholder="Max length (optional)"
            className={inputClass}
          />
          <textarea
            value={freeResponse.rubric}
            onChange={(e) =>
              setFreeResponse((prev) => ({ ...prev, rubric: e.target.value }))
            }
            placeholder="Grading rubric (optional)"
            className={inputClass}
            rows={2}
          />
        </>
      )}

      {type === "SLIDER" && (
        <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <label>
            Min
            <input
              type="number"
              value={slider.min}
              onChange={(e) =>
                setSlider({ ...slider, min: Number(e.target.value) })
              }
              className={inputClass}
            />
          </label>
          <label>
            Max
            <input
              type="number"
              value={slider.max}
              onChange={(e) =>
                setSlider({ ...slider, max: Number(e.target.value) })
              }
              className={inputClass}
            />
          </label>
          <label>
            Correct
            <input
              type="number"
              value={slider.correct}
              onChange={(e) =>
                setSlider({ ...slider, correct: Number(e.target.value) })
              }
              className={inputClass}
            />
          </label>
          <label>
            Tolerance
            <input
              type="number"
              value={slider.tolerance}
              onChange={(e) =>
                setSlider({ ...slider, tolerance: Number(e.target.value) })
              }
              className={inputClass}
            />
          </label>
        </div>
      )}

      {type === "MATCHING" && (
        <div className="space-y-3">
          {pairs.map((p, i) => (
            <div key={i} className="flex flex-col gap-2 sm:flex-row">
              <input
                value={p.left}
                onChange={(e) =>
                  setPairs((prev) =>
                    prev.map((x, j) =>
                      j === i ? { ...x, left: e.target.value } : x,
                    ),
                  )
                }
                placeholder="Left"
                className={inputClass}
              />
              <input
                value={p.right}
                onChange={(e) =>
                  setPairs((prev) =>
                    prev.map((x, j) =>
                      j === i ? { ...x, right: e.target.value } : x,
                    ),
                  )
                }
                placeholder="Right"
                className={inputClass}
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() => setPairs((p) => [...p, { left: "", right: "" }])}
            className="min-h-11 text-sm text-storm-medium-blue"
          >
            + Add pair
          </button>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="submit"
          disabled={saving}
          className="min-h-11 w-full rounded-lg bg-storm-medium-blue px-4 py-2.5 text-sm text-white disabled:opacity-50 sm:w-auto"
        >
          {saving ? "Saving…" : isEdit ? "Save changes" : "Add question"}
        </button>
        {isEdit && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="min-h-11 w-full rounded-lg border border-storm-light-blue/60 px-4 py-2.5 text-sm font-medium text-storm-navy sm:w-auto"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
