"use client";

import { markCourseItemComplete } from "@/lib/actions/course-progress";
import { useState } from "react";

export function LessonItemView({
  courseItemId,
  bodyHtml,
  completionRule,
}: {
  courseItemId: string;
  bodyHtml: string | null;
  completionRule: string;
}) {
  const [busy, setBusy] = useState(false);

  async function markComplete() {
    setBusy(true);
    await markCourseItemComplete(courseItemId);
    setBusy(false);
  }

  return (
    <div className="mt-6">
      {bodyHtml ? (
        <div
          className="prose prose-sm max-w-none rounded-xl border bg-white p-5 text-storm-navy"
          dangerouslySetInnerHTML={{ __html: bodyHtml }}
        />
      ) : (
        <p className="text-sm text-storm-navy/60">No content yet.</p>
      )}
      {completionRule === "manual" && (
        <button
          type="button"
          disabled={busy}
          onClick={markComplete}
          className="mt-6 min-h-11 rounded-lg bg-storm-medium-blue px-6 py-2.5 text-sm font-semibold text-white"
        >
          {busy ? "Saving…" : "Mark complete"}
        </button>
      )}
    </div>
  );
}
