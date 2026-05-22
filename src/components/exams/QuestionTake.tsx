"use client";

import type { QuestionType } from "@prisma/client";

type QuestionData = {
  id: string;
  type: QuestionType;
  text: string;
  config: unknown;
  options: { id: string; text: string }[];
};

export function QuestionTake({
  question,
  index,
  value,
  onChange,
}: {
  question: QuestionData;
  index: number;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const cfg = question.config as Record<string, unknown> | null;

  return (
    <fieldset className="rounded-xl border border-storm-light-blue/60 bg-white p-5">
      <legend className="font-medium text-storm-navy">
        {index + 1}. {question.text}
      </legend>
      <div className="mt-4">
        {question.type === "MULTIPLE_CHOICE" && (
          <div className="space-y-2">
            {question.options.map((o) => (
              <label key={o.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 py-3 hover:bg-storm-light-grey/50">
                <input
                  type="radio"
                  name={question.id}
                  className="h-5 w-5 shrink-0"
                  checked={(value as { optionId?: string })?.optionId === o.id}
                  onChange={() => onChange({ optionId: o.id })}
                  required
                />
                <span className="text-sm break-words">{o.text}</span>
              </label>
            ))}
          </div>
        )}

        {question.type === "MULTIPLE_SELECT" && (
          <div className="space-y-2">
            {question.options.map((o) => {
              const ids = ((value as { optionIds?: string[] })?.optionIds) ?? [];
              return (
                <label key={o.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 py-3 hover:bg-storm-light-grey/50">
                  <input
                    type="checkbox"
                    className="h-5 w-5 shrink-0"
                    checked={ids.includes(o.id)}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...ids, o.id]
                        : ids.filter((id) => id !== o.id);
                      onChange({ optionIds: next });
                    }}
                  />
                  <span className="text-sm">{o.text}</span>
                </label>
              );
            })}
          </div>
        )}

        {question.type === "FREE_RESPONSE" && (
          <textarea
            value={(value as { text?: string })?.text ?? ""}
            onChange={(e) => onChange({ text: e.target.value })}
            maxLength={cfg?.maxLength as number | undefined}
            rows={5}
            required
            className="w-full min-h-11 rounded-lg border border-storm-light-blue/60 px-3 py-2 text-sm"
            placeholder="Your answer"
          />
        )}

        {question.type === "SLIDER" && (
          <div>
            <input
              type="range"
              min={Number(cfg?.min ?? 0)}
              max={Number(cfg?.max ?? 100)}
              step={Number(cfg?.step ?? 1)}
              value={Number((value as { value?: number })?.value ?? cfg?.min ?? 0)}
              onChange={(e) => onChange({ value: Number(e.target.value) })}
              className="w-full"
            />
            <p className="mt-2 text-sm text-storm-navy/70">
              Selected: {String((value as { value?: number })?.value ?? cfg?.min ?? 0)}
            </p>
          </div>
        )}

        {question.type === "MATCHING" && (
          <div className="space-y-3">
            {((cfg?.pairs as { left: string; right: string }[]) ?? []).map((pair) => {
              const rights = (cfg?.pairs as { left: string; right: string }[])?.map((p) => p.right) ?? [];
              const pairs = (value as { pairs?: Record<string, string> })?.pairs ?? {};
              return (
                <div key={pair.left} className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center">
                  <span className="font-medium break-words sm:min-w-[8rem]">{pair.left}</span>
                  <select
                    value={pairs[pair.left] ?? ""}
                    onChange={(e) =>
                      onChange({ pairs: { ...pairs, [pair.left]: e.target.value } })
                    }
                    required
                    className="min-h-11 w-full rounded-lg border border-storm-light-blue/60 px-3 py-2 sm:flex-1"
                  >
                    <option value="">Select…</option>
                    {rights.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </fieldset>
  );
}
