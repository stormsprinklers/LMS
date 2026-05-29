"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { CourseItemNavLink } from "@/lib/courses/item-navigation";
import {
  DEFAULT_REQUIRED_WATCH_PERCENT,
  hasMetWatchRequirement,
  watchPercent,
} from "@/lib/courses/video-watch";

const btnBase =
  "inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold no-underline transition-colors sm:flex-initial sm:min-w-[9rem]";

export function CourseItemNav({
  previous,
  next,
  position,
  total,
  preview = false,
  videoRequirement,
}: {
  previous: CourseItemNavLink | null;
  next: CourseItemNavLink | null;
  position: number;
  total: number;
  preview?: boolean;
  /** Live video watch state — gates the Next button until requirement is met. */
  videoRequirement?: {
    watchedSeconds: number;
    durationSeconds: number;
    requiredPercent: number;
  };
}) {
  const requiredPct =
    videoRequirement?.requiredPercent ?? DEFAULT_REQUIRED_WATCH_PERCENT;
  const duration = videoRequirement?.durationSeconds ?? 0;
  const watched = videoRequirement?.watchedSeconds ?? 0;
  const watchMet =
    !videoRequirement ||
    hasMetWatchRequirement(watched, duration, requiredPct);
  const pct = watchPercent(watched, duration);

  const nextBlocked =
    next &&
    (next.access === "locked" ||
      (videoRequirement && !watchMet));

  let nextHint = "";
  if (next?.access === "locked") {
    nextHint = "Complete earlier activities to unlock the next item.";
  } else if (videoRequirement && !watchMet && duration > 0) {
    nextHint = `Watch at least ${requiredPct}% of this video to continue (${pct}% so far).`;
  } else if (videoRequirement && !watchMet) {
    nextHint = "Keep watching to unlock the next item.";
  }

  return (
    <nav
      className="mt-8 border-t border-storm-light-blue/40 pt-6"
      aria-label="Course activity navigation"
    >
      <p className="mb-3 text-center text-xs text-storm-navy/55">
        Activity {position} of {total}
        {preview ? " · Preview" : ""}
      </p>

      {videoRequirement && duration > 0 && (
        <div className="mb-4">
          <div className="flex justify-between text-xs text-storm-navy/70">
            <span>Watch progress</span>
            <span>
              {pct}% / {requiredPct}% required
            </span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-storm-light-grey">
            <div
              className="h-full rounded-full bg-storm-medium-blue transition-all duration-300"
              style={{ width: `${Math.min(100, pct)}%` }}
            />
          </div>
        </div>
      )}

      {nextHint && (
        <p className="mb-3 text-center text-sm text-amber-800">{nextHint}</p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
        {previous && previous.access !== "locked" ? (
          <Link href={previous.href} className={`${btnBase} border border-storm-light-blue/60 bg-white text-storm-navy hover:bg-storm-light-grey/50`}>
            <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
            <span className="truncate">Previous</span>
          </Link>
        ) : (
          <span
            className={`${btnBase} cursor-not-allowed border border-storm-light-blue/30 bg-storm-light-grey/40 text-storm-navy/40`}
            aria-disabled
          >
            <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
            Previous
          </span>
        )}

        {next && !nextBlocked ? (
          <Link
            href={next.href}
            className={`${btnBase} bg-storm-medium-blue text-white hover:bg-storm-medium-blue/90 sm:ml-auto`}
          >
            <span className="truncate">Next</span>
            <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
          </Link>
        ) : (
          <span
            className={`${btnBase} cursor-not-allowed bg-storm-medium-blue/35 text-white/90 sm:ml-auto`}
            aria-disabled
            title={nextHint || undefined}
          >
            <span className="truncate">Next</span>
            <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
          </span>
        )}
      </div>
    </nav>
  );
}
