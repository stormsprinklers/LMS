"use client";

import {
  createMuxUploadForCourseItem,
  getVideoLessonUploadStatus,
} from "@/lib/actions/media";
import MuxPlayer from "@mux/mux-player-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Upload } from "lucide-react";

export function VideoFileUpload({
  courseItemId,
  playbackId,
  uploadStatus,
}: {
  courseItemId: string;
  playbackId: string | null;
  uploadStatus: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(
    uploadStatus === "processing" && !playbackId,
  );
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<number | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  function startPolling() {
    if (pollRef.current) clearInterval(pollRef.current);
    setProcessing(true);
    pollRef.current = setInterval(async () => {
      const status = await getVideoLessonUploadStatus(courseItemId);
      if (status.muxPlaybackId) {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        setProcessing(false);
        router.refresh();
      }
    }, 3000);
    setTimeout(() => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
        setProcessing(false);
      }
    }, 180_000);
  }

  async function handleFile(file: File) {
    setError("");
    setProgress(0);
    setUploading(true);

    const created = await createMuxUploadForCourseItem(courseItemId);
    if (created.error || !created.url) {
      setUploading(false);
      setError(created.error ?? "Could not start upload.");
      return;
    }

    try {
      await uploadWithProgress(created.url, file, setProgress);
    } catch {
      setUploading(false);
      setError("Upload failed. Check your connection and try again.");
      return;
    }

    setUploading(false);
    setProgress(null);
    startPolling();
  }

  const busy = uploading || processing;

  return (
    <div className="space-y-3 rounded-xl border border-storm-light-blue/60 bg-storm-light-grey/30 p-4">
      <p className="text-sm font-medium text-storm-navy">Video file</p>

      {playbackId ? (
        <div className="overflow-hidden rounded-lg bg-storm-navy">
          <MuxPlayer
            playbackId={playbackId}
            streamType="on-demand"
            className="aspect-video w-full"
            accentColor="#4C9BC8"
          />
        </div>
      ) : (
        <p className="text-sm text-storm-navy/60">No video uploaded yet.</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="video/*,.mp4,.mov,.webm,.m4v"
        className="sr-only"
        disabled={busy}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = "";
        }}
      />

      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-storm-medium-blue/50 bg-white px-4 py-2 text-sm font-semibold text-storm-medium-blue disabled:opacity-50"
      >
        <Upload className="h-4 w-4" />
        {uploading
          ? progress != null
            ? `Uploading… ${progress}%`
            : "Uploading…"
          : processing
            ? "Processing video…"
            : playbackId
              ? "Replace video"
              : "Upload video"}
      </button>

      {processing && (
        <p className="text-xs text-storm-navy/60">
          Mux is encoding your file. This usually takes a minute or two — you can keep
          editing other fields.
        </p>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      <p className="text-xs text-storm-navy/50">
        MP4, MOV, or WebM recommended. Requires Mux credentials in production.
      </p>
    </div>
  );
}

function uploadWithProgress(
  url: string,
  file: File,
  onProgress: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type || "video/mp4");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed: ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.send(file);
  });
}
