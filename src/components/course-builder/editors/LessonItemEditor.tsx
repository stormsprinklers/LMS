"use client";

import { updateCourseItem, updateLessonContent } from "@/lib/actions/course-builder";
import { TiptapEditor, type TiptapEditorHandle } from "./TiptapEditor";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { ContentStatus } from "@prisma/client";
import { useBuilderFormDirty } from "../useBuilderFormDirty";

const inputClass =
  "mt-1 w-full min-h-10 rounded-lg border border-storm-light-blue/60 px-3 py-2 text-sm";

const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph" }] };

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

export function LessonItemEditor({
  item,
  onSaved,
}: {
  item: Item;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const { markDirty, resolveSave, formDirtyProps } = useBuilderFormDirty(
    `lesson-${item.id}`,
    formRef,
  );
  const editorRef = useRef<TiptapEditorHandle>(null);
  const initialJson = item.lessonContent?.bodyJson ?? EMPTY_DOC;
  const [bodyJson, setBodyJson] = useState<unknown>(initialJson);
  const [bodyHtml, setBodyHtml] = useState(item.lessonContent?.bodyHtml ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSaved(false);

    try {
      const snapshot = editorRef.current?.getContent();
      const json = snapshot?.json ?? bodyJson ?? EMPTY_DOC;
      const html = snapshot?.html ?? bodyHtml;

      const fd = new FormData(e.currentTarget);
      const completionRule = String(fd.get("completionRule"));
      const minimumRaw = fd.get("minimumTimeSeconds");
      const minimumTimeSeconds =
        minimumRaw === "" || minimumRaw === null ? null : Number(minimumRaw);

      await updateCourseItem(item.id, {
        title: String(fd.get("title")),
        isRequired: fd.get("isRequired") === "on",
        estimatedMinutes: Number(fd.get("estimatedMinutes")) || undefined,
        completionRule,
        status: String(fd.get("status")) as ContentStatus,
      });

      const contentResult = await updateLessonContent(item.id, {
        bodyJson: json,
        bodyHtml: html,
        completionRule,
        minimumTimeSeconds: minimumTimeSeconds ?? undefined,
      });

      if (contentResult && "error" in contentResult && contentResult.error) {
        setError(contentResult.error);
        resolveSave(false);
        return;
      }

      setBodyJson(json);
      setBodyHtml(html);
      setSaved(true);
      resolveSave(true);
      onSaved?.();
      router.refresh();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to save lesson. Try again.";
      setError(message);
      resolveSave(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} {...formDirtyProps} className="space-y-3">
      <label className="block text-sm">
        Title
        <input name="title" defaultValue={item.title} required className={inputClass} />
      </label>
      <div>
        <p className="text-sm font-medium text-storm-navy">Content</p>
        <p className="mb-1 text-xs text-storm-navy/60">
          Use headings, lists, photos, links, and YouTube embeds. Changes save when you click Save
          lesson.
        </p>
        <TiptapEditor
          ref={editorRef}
          key={item.id}
          content={initialJson}
          onChange={(json, html) => {
            setBodyJson(json);
            setBodyHtml(html);
            setSaved(false);
            markDirty();
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
      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && !error && (
        <p className="text-sm text-green-700">Lesson saved.</p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="min-h-10 w-full rounded-lg bg-storm-medium-blue text-sm font-semibold text-white disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save lesson"}
      </button>
    </form>
  );
}
