"use client";

import { updateCourseItem, updateLessonContent } from "@/lib/actions/course-builder";
import { TiptapEditor } from "./TiptapEditor";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ContentStatus } from "@prisma/client";

const inputClass =
  "mt-1 w-full min-h-10 rounded-lg border border-storm-light-blue/60 px-3 py-2 text-sm";

type Item = {
  id: string;
  title: string;
  isRequired: boolean;
  estimatedMinutes: number | null;
  completionRule: string;
  status: ContentStatus;
  lessonContent: {
    bodyJson: unknown;
    bodyHtml: string | null;
    completionRule: string;
    minimumTimeSeconds: number | null;
  } | null;
};

export function LessonItemEditor({ item }: { item: Item }) {
  const router = useRouter();
  const [bodyJson, setBodyJson] = useState(item.lessonContent?.bodyJson);
  const [bodyHtml, setBodyHtml] = useState(item.lessonContent?.bodyHtml ?? "");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    await updateCourseItem(item.id, {
      title: String(fd.get("title")),
      isRequired: fd.get("isRequired") === "on",
      estimatedMinutes: Number(fd.get("estimatedMinutes")) || undefined,
      completionRule: String(fd.get("completionRule")),
      status: String(fd.get("status")) as ContentStatus,
    });
    await updateLessonContent(item.id, {
      bodyJson,
      bodyHtml,
      completionRule: String(fd.get("completionRule")),
      minimumTimeSeconds: Number(fd.get("minimumTimeSeconds")) || undefined,
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <label className="block text-sm">
        Title
        <input name="title" defaultValue={item.title} required className={inputClass} />
      </label>
      <div>
        <p className="text-sm font-medium text-storm-navy">Content</p>
        <TiptapEditor
          content={bodyJson}
          onChange={(json, html) => {
            setBodyJson(json);
            setBodyHtml(html);
          }}
        />
      </div>
      <label className="block text-sm">
        Completion rule
        <select
          name="completionRule"
          defaultValue={item.completionRule}
          className={inputClass}
        >
          <option value="manual">Mark complete manually</option>
          <option value="viewed">Complete after viewing</option>
          <option value="minimum_time">Minimum time on page</option>
          <option value="quiz_passed">Pass attached quiz</option>
        </select>
      </label>
      <label className="block text-sm">
        Minimum time (seconds)
        <input
          name="minimumTimeSeconds"
          type="number"
          min={0}
          defaultValue={item.lessonContent?.minimumTimeSeconds ?? ""}
          className={inputClass}
        />
      </label>
      <label className="block text-sm">
        Estimated minutes
        <input
          name="estimatedMinutes"
          type="number"
          min={0}
          defaultValue={item.estimatedMinutes ?? ""}
          className={inputClass}
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isRequired" defaultChecked={item.isRequired} className="h-4 w-4" />
        Required
      </label>
      <label className="block text-sm">
        Status
        <select name="status" defaultValue={item.status} className={inputClass}>
          <option value="DRAFT">Draft</option>
          <option value="READY">Ready</option>
          <option value="PUBLISHED">Published</option>
        </select>
      </label>
      <button
        type="submit"
        disabled={busy}
        className="min-h-10 w-full rounded-lg bg-storm-medium-blue text-sm font-semibold text-white"
      >
        {busy ? "Saving…" : "Save lesson"}
      </button>
    </form>
  );
}
