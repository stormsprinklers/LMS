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
  unanswered = false,
}: {
  question: QuestionData;
  index: number;
  value: unknown;
  onChange: (v: unknown) => void;
  unanswered?: boolean;
}) {
  const cfg = question.config as Record<string, unknown> | null;
  const titleId = `question-${question.id}-title`;

  return (
    <section
      aria-labelledby={titleId}
      className={`rounded-xl border bg-white p-4 sm:p-5 ${
        unanswered
          ? "border-amber-400 ring-2 ring-amber-200"
          : "border-storm-light-blue/60"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2
          id={titleId}
          className="text-base font-medium leading-snug text-storm-navy sm:text-[1.05rem]"
        >
          <span className="text-storm-navy/70">{index + 1}. </span>
          {question.text}
        </h2>
        {unanswered && (
          <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
            Not answered
          </span>
        )}
      </div>

      <div className="mt-4">
        {question.type === "MULTIPLE_CHOICE" && (
          <div className="space-y-1" role="radiogroup" aria-labelledby={titleId}>
            {question.options.map((o) => (
              <label
                key={o.id}
                className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 py-3 hover:bg-storm-light-grey/50"
              >
                <input
                  type="radio"
                  name={question.id}
                  className="h-5 w-5 shrink-0"
                  checked={(value as { optionId?: string })?.optionId === o.id}
                  onChange={() => onChange({ optionId: o.id })}
                />
                <span className="text-sm break-words">{o.text}</span>
              </label>
            ))}
          </div>
        )}

        {question.type === "MULTIPLE_SELECT" && (
          <div className="space-y-1" role="group" aria-labelledby={titleId}>
            {question.options.map((o) => {
              const ids = ((value as { optionIds?: string[] })?.optionIds) ?? [];
              return (
                <label
                  key={o.id}
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 py-3 hover:bg-storm-light-grey/50"
                >
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
                  <span className="text-sm break-words">{o.text}</span>
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
            aria-labelledby={titleId}
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
              aria-labelledby={titleId}
              className="w-full"
            />
            <p className="mt-2 text-sm text-storm-navy/70">
              Selected: {String((value as { value?: number })?.value ?? cfg?.min ?? 0)}
            </p>
          </div>
        )}

        {question.type === "MATCHING" && (
          <div className="space-y-4" role="group" aria-labelledby={titleId}>
            {((cfg?.pairs as { left: string; right: string }[]) ?? []).map((pair, pairIndex) => {
              const rights =
                (cfg?.pairs as { left: string; right: string }[])?.map((p) => p.right) ?? [];
              const pairs = (value as { pairs?: Record<string, string> })?.pairs ?? {};
              const selectId = `${question.id}-match-${pairIndex}`;
              return (
                <div
                  key={pair.left}
                  className="grid grid-cols-1 gap-2 border-t border-storm-light-blue/40 pt-4 first:border-t-0 first:pt-0 sm:grid-cols-[minmax(0,11rem)_1fr] sm:items-center sm:gap-4"
                >
                  <label
                    htmlFor={selectId}
                    className="text-sm font-medium leading-snug text-storm-navy break-words"
                  >
                    {pair.left}
                  </label>
                  <select
                    id={selectId}
                    value={pairs[pair.left] ?? ""}
                    onChange={(e) =>
                      onChange({ pairs: { ...pairs, [pair.left]: e.target.value } })
                    }
                    className="min-h-11 w-full rounded-lg border border-storm-light-blue/60 bg-white px-3 py-2 text-sm text-storm-navy focus:border-storm-medium-blue focus:outline-none focus:ring-2 focus:ring-storm-medium-blue/30"
                  >
                    <option value="">Select…</option>
                    {rights.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
