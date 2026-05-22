"use client";

import { updateCourseItem, updateVideoLessonContent } from "@/lib/actions/course-builder";
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
  videoLesson: {
    videoUrl: string | null;
    muxPlaybackId: string | null;
    transcript: string | null;
    requiredWatchPercent: number;
    completionRule: string;
  } | null;
  legacyLesson: {
    videoAsset: { muxPlaybackId: string | null } | null;
  } | null;
};

export function VideoItemEditor({ item }: { item: Item }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const playbackId =
    item.videoLesson?.muxPlaybackId ??
    item.legacyLesson?.videoAsset?.muxPlaybackId ??
    "";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    await updateCourseItem(item.id, {
      title: String(fd.get("title")),
      isRequired: fd.get("isRequired") === "on",
      completionRule: String(fd.get("completionRule")),
      status: String(fd.get("status")) as ContentStatus,
    });
    await updateVideoLessonContent(item.id, {
      videoUrl: String(fd.get("videoUrl") || "") || undefined,
      muxPlaybackId: String(fd.get("muxPlaybackId") || "") || undefined,
      transcript: String(fd.get("transcript") || "") || undefined,
      requiredWatchPercent: Number(fd.get("requiredWatchPercent")) || 80,
      completionRule: String(fd.get("completionRule")),
      estimatedMinutes: Number(fd.get("estimatedMinutes")) || undefined,
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
      <label className="block text-sm">
        Mux playback ID
        <input name="muxPlaybackId" defaultValue={playbackId} className={inputClass} />
      </label>
      <label className="block text-sm">
        Video URL (optional external)
        <input
          name="videoUrl"
          defaultValue={item.videoLesson?.videoUrl ?? ""}
          className={inputClass}
        />
      </label>
      <label className="block text-sm">
        Transcript
        <textarea
          name="transcript"
          rows={3}
          defaultValue={item.videoLesson?.transcript ?? ""}
          className={inputClass}
        />
      </label>
      <label className="block text-sm">
        Required watch %
        <input
          name="requiredWatchPercent"
          type="number"
          min={1}
          max={100}
          defaultValue={item.videoLesson?.requiredWatchPercent ?? 80}
          className={inputClass}
        />
      </label>
      <label className="block text-sm">
        Completion rule
        <select
          name="completionRule"
          defaultValue={item.completionRule}
          className={inputClass}
        >
          <option value="watch_percent">After watch requirement</option>
          <option value="manual">Manual completion</option>
          <option value="quiz_passed">After quiz passed</option>
        </select>
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
          <option value="PUBLISHED">Published</option>
        </select>
      </label>
      <button
        type="submit"
        disabled={busy}
        className="min-h-10 w-full rounded-lg bg-storm-medium-blue text-sm font-semibold text-white"
      >
        {busy ? "Saving…" : "Save video"}
      </button>
    </form>
  );
}
