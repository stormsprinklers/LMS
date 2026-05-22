"use client";

import { addQuestion } from "@/lib/actions/exams-admin";
import type { QuestionType } from "@prisma/client";
import { useState } from "react";

const TYPES: { value: QuestionType; label: string }[] = [
  { value: "MULTIPLE_CHOICE", label: "Multiple choice" },
  { value: "MULTIPLE_SELECT", label: "Select all that apply" },
  { value: "FREE_RESPONSE", label: "Free response" },
  { value: "SLIDER", label: "Slider" },
  { value: "MATCHING", label: "Matching" },
];

export function QuestionEditor({
  examId,
  nextSortOrder,
}: {
  examId: string;
  nextSortOrder: number;
}) {
  const [type, setType] = useState<QuestionType>("MULTIPLE_CHOICE");
  const [text, setText] = useState("");
  const [options, setOptions] = useState([
    { text: "", isCorrect: true },
    { text: "", isCorrect: false },
    { text: "", isCorrect: false },
    { text: "", isCorrect: false },
  ]);
  const [slider, setSlider] = useState({ min: 0, max: 100, correct: 50, tolerance: 2 });
  const [pairs, setPairs] = useState([
    { left: "", right: "" },
    { left: "", right: "" },
  ]);
  const [maxLength, setMaxLength] = useState("");
  const [rubric, setRubric] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (type === "MULTIPLE_CHOICE" || type === "MULTIPLE_SELECT") {
        const opts = options.filter((o) => o.text.trim());
        await addQuestion(examId, {
          type,
          text,
          sortOrder: nextSortOrder,
          options: opts,
        });
      } else if (type === "FREE_RESPONSE") {
        await addQuestion(examId, {
          type,
          text,
          sortOrder: nextSortOrder,
          config: {
            maxLength: maxLength ? parseInt(maxLength, 10) : undefined,
            rubric: rubric || undefined,
          },
        });
      } else if (type === "SLIDER") {
        await addQuestion(examId, {
          type,
          text,
          sortOrder: nextSortOrder,
          config: {
            min: slider.min,
            max: slider.max,
            step: 1,
            correctValue: slider.correct,
            tolerance: slider.tolerance,
          },
        });
      } else {
        await addQuestion(examId, {
          type: "MATCHING",
          text,
          sortOrder: nextSortOrder,
          config: { pairs: pairs.filter((p) => p.left && p.right) },
        });
      }
      setText("");
      setOptions([
        { text: "", isCorrect: true },
        { text: "", isCorrect: false },
        { text: "", isCorrect: false },
        { text: "", isCorrect: false },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    }
    setSaving(false);
  }

  const inputClass =
    "w-full min-h-11 rounded-lg border border-storm-light-blue/60 px-3 py-2 text-sm";

  return (
    <form onSubmit={handleSubmit} className="w-full rounded-xl border bg-white p-4 sm:p-5 space-y-4">
      <h3 className="font-medium text-storm-navy">Add question</h3>
      <select
        value={type}
        onChange={(e) => setType(e.target.value as QuestionType)}
        className={inputClass}
      >
        {TYPES.map((t) => (
          <option key={t.value} value={t.value}>{t.label}</option>
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
            <div key={i} className="flex min-h-11 items-center gap-3">
              <input
                type={type === "MULTIPLE_CHOICE" ? "radio" : "checkbox"}
                name="correct"
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
                    prev.map((p, j) => (j === i ? { ...p, text: e.target.value } : p)),
                  )
                }
                placeholder={`Option ${String.fromCharCode(65 + i)}`}
                className={`flex-1 ${inputClass}`}
              />
            </div>
          ))}
        </div>
      )}

      {type === "FREE_RESPONSE" && (
        <>
          <input
            type="number"
            value={maxLength}
            onChange={(e) => setMaxLength(e.target.value)}
            placeholder="Max length (optional)"
            className={inputClass}
          />
          <textarea
            value={rubric}
            onChange={(e) => setRubric(e.target.value)}
            placeholder="Grading rubric (optional)"
            className={inputClass}
            rows={2}
          />
        </>
      )}

      {type === "SLIDER" && (
        <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <label>Min<input type="number" value={slider.min} onChange={(e) => setSlider({ ...slider, min: Number(e.target.value) })} className={inputClass} /></label>
          <label>Max<input type="number" value={slider.max} onChange={(e) => setSlider({ ...slider, max: Number(e.target.value) })} className={inputClass} /></label>
          <label>Correct<input type="number" value={slider.correct} onChange={(e) => setSlider({ ...slider, correct: Number(e.target.value) })} className={inputClass} /></label>
          <label>Tolerance<input type="number" value={slider.tolerance} onChange={(e) => setSlider({ ...slider, tolerance: Number(e.target.value) })} className={inputClass} /></label>
        </div>
      )}

      {type === "MATCHING" && (
        <div className="space-y-3">
          {pairs.map((p, i) => (
            <div key={i} className="flex flex-col gap-2 sm:flex-row">
              <input value={p.left} onChange={(e) => setPairs((prev) => prev.map((x, j) => j === i ? { ...x, left: e.target.value } : x))} placeholder="Left" className={inputClass} />
              <input value={p.right} onChange={(e) => setPairs((prev) => prev.map((x, j) => j === i ? { ...x, right: e.target.value } : x))} placeholder="Right" className={inputClass} />
            </div>
          ))}
          <button type="button" onClick={() => setPairs((p) => [...p, { left: "", right: "" }])} className="min-h-11 text-sm text-storm-medium-blue">+ Add pair</button>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={saving} className="min-h-11 w-full rounded-lg bg-storm-medium-blue px-4 py-2.5 text-sm text-white disabled:opacity-50 sm:w-auto">
        {saving ? "Saving…" : "Add question"}
      </button>
    </form>
  );
}
