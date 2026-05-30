"use client";

import { useEffect, useState } from "react";
import type { AiOperationProgress } from "@/lib/ai/ai-operation-progress";
import { Check, Circle, Loader2 } from "lucide-react";

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return min > 0 ? `${min}:${sec.toString().padStart(2, "0")}` : `${sec}s`;
}

function StepIcon({ status }: { status: AiOperationProgress["steps"][0]["status"] }) {
  if (status === "done") {
    return <Check className="h-4 w-4 shrink-0 text-green-600" aria-hidden />;
  }
  if (status === "active") {
    return (
      <Loader2
        className="h-4 w-4 shrink-0 animate-spin text-storm-medium-blue"
        aria-hidden
      />
    );
  }
  if (status === "error") {
    return <Circle className="h-4 w-4 shrink-0 text-red-500" aria-hidden />;
  }
  return <Circle className="h-4 w-4 shrink-0 text-storm-navy/25" aria-hidden />;
}

export function AiLoadingView({
  progress,
  compact = false,
}: {
  progress: AiOperationProgress;
  compact?: boolean;
}) {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const tick = () => setElapsedMs(Date.now() - progress.startedAt);
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [progress.startedAt]);

  const stuckHint = elapsedMs >= 120_000;

  return (
    <div
      className={`flex flex-col items-center justify-center ${compact ? "gap-2 py-4" : "gap-4 py-10"}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div
        className="h-10 w-10 animate-spin rounded-full border-2 border-storm-light-blue/80 border-t-storm-medium-blue"
        aria-hidden
      />

      <div className="w-full max-w-md space-y-3 text-center">
        <div>
          <p className="text-sm font-semibold text-storm-navy">{progress.title}</p>
          <p className="mt-1 text-sm text-storm-medium-blue">{progress.detail}</p>
        </div>

        {progress.steps.length > 0 && (
          <ul className="mx-auto max-w-sm space-y-1.5 rounded-lg border border-storm-light-blue/40 bg-storm-light-grey/20 px-3 py-2.5 text-left text-xs">
            {progress.steps.map((s) => (
              <li
                key={s.id}
                className={`flex items-start gap-2 ${
                  s.status === "active"
                    ? "font-medium text-storm-navy"
                    : s.status === "done"
                      ? "text-storm-navy/60"
                      : "text-storm-navy/40"
                }`}
              >
                <StepIcon status={s.status} />
                <span className="min-w-0 flex-1">{s.label}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-col gap-1 text-xs text-storm-navy/50">
          <p>Elapsed: {formatElapsed(elapsedMs)}</p>
          {progress.timeEstimate ? <p>{progress.timeEstimate}</p> : null}
          {stuckHint ? (
            <p className="text-amber-800">
              Still running — if the status above stops changing for several minutes,
              use Stop and try again.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Fallback when no detailed progress is set yet. */
export function AiLoadingSpinner({
  label,
  timeEstimate,
}: {
  label?: string;
  timeEstimate?: string;
}) {
  const progress: AiOperationProgress = {
    title: label ?? "Working…",
    detail: "Please wait…",
    timeEstimate,
    startedAt: Date.now(),
    steps: [],
  };

  return <AiLoadingView progress={progress} compact />;
}
