"use client";

import { updateCourseItem, updateVideoLessonContent } from "@/lib/actions/course-builder";
import { YouTubeIframe } from "@/components/video/YouTubeIframe";
import { isYouTubeUrl, parseYouTubeVideoId } from "@/lib/video/youtube";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useBuilderFormDirty } from "../useBuilderFormDirty";
import type { ContentStatus } from "@prisma/client";
import { VideoFileUpload } from "./VideoFileUpload";

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
    status: string;
  } | null;
  legacyLesson: {
    videoAsset: { muxPlaybackId: string | null } | null;
  } | null;
};

export function VideoItemEditor({ item }: { item: Item }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const { resolveSave, formDirtyProps } = useBuilderFormDirty(`video-${item.id}`, formRef);
  const [busy, setBusy] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const savedVideoUrl = item.videoLesson?.videoUrl ?? "";
  const playbackId =
    item.videoLesson?.muxPlaybackId ??
    item.legacyLesson?.videoAsset?.muxPlaybackId ??
    null;
  const savedYouTubeId = parseYouTubeVideoId(savedVideoUrl);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    try {
    await updateCourseItem(item.id, {
      title: String(fd.get("title")),
      isRequired: fd.get("isRequired") === "on",
      completionRule: String(fd.get("completionRule")),
      status: String(fd.get("status")) as ContentStatus,
    });
    await updateVideoLessonContent(item.id, {
      videoUrl: String(fd.get("videoUrl") ?? "").trim() || null,
      muxPlaybackId: String(fd.get("muxPlaybackId") || "").trim() || null,
      transcript: String(fd.get("transcript") || "") || undefined,
      requiredWatchPercent: Number(fd.get("requiredWatchPercent")) || 75,
      completionRule: String(fd.get("completionRule")),
      estimatedMinutes: Number(fd.get("estimatedMinutes")) || undefined,
    });
    resolveSave(true);
    router.refresh();
    } catch {
      resolveSave(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} {...formDirtyProps} className="space-y-3">
      <VideoFileUpload
        courseItemId={item.id}
        playbackId={playbackId}
        uploadStatus={item.videoLesson?.status ?? null}
      />

      <p className="text-center text-xs font-medium uppercase tracking-wide text-storm-navy/40">
        or
      </p>

      <div className="space-y-3 rounded-xl border border-storm-light-blue/60 bg-storm-light-grey/30 p-4">
        <label className="block text-sm font-medium text-storm-navy">
          YouTube link
          <input
            name="videoUrl"
            defaultValue={savedVideoUrl}
            className={inputClass}
            placeholder="https://www.youtube.com/watch?v=…"
          />
        </label>
        <p className="text-xs text-storm-navy/50">
          Paste a YouTube watch, share, or embed URL. Used when no uploaded video is set.
          {playbackId && " An uploaded video currently takes priority over YouTube."}
        </p>
        {savedYouTubeId && (
          <div className="overflow-hidden rounded-lg">
            <YouTubeIframe urlOrId={savedVideoUrl} title="YouTube preview" />
          </div>
        )}
        {savedVideoUrl && !isYouTubeUrl(savedVideoUrl) && (
          <p className="text-xs text-amber-800">
            This link is not a recognized YouTube URL. It will play as a direct video file if
            supported by the browser.
          </p>
        )}
      </div>

      <label className="block text-sm">
        Title
        <input name="title" defaultValue={item.title} required className={inputClass} />
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
          defaultValue={item.videoLesson?.requiredWatchPercent ?? 75}
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
        type="button"
        onClick={() => setShowAdvanced((v) => !v)}
        className="text-sm text-storm-medium-blue hover:underline"
      >
        {showAdvanced ? "Hide" : "Show"} advanced options
      </button>

      {showAdvanced && (
        <div className="space-y-3 rounded-lg border border-dashed border-storm-light-blue/60 p-3">
          <label className="block text-sm">
            Mux playback ID (manual)
            <input
              name="muxPlaybackId"
              defaultValue={playbackId ?? ""}
              className={inputClass}
              placeholder="Only if not using upload above"
            />
          </label>
        </div>
      )}

      <button
        type="submit"
        disabled={busy}
        className="min-h-10 w-full rounded-lg bg-storm-medium-blue text-sm font-semibold text-white"
      >
        {busy ? "Saving…" : "Save video settings"}
      </button>
    </form>
  );
}
