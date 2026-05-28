"use client";

import { createMuxUpload } from "@/lib/actions/media";
import { useRef, useState } from "react";
import { Upload } from "lucide-react";

export function VideoUploadForm({ lessonId }: { lessonId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function handleFile(file: File) {
    setBusy(true);
    setError("");
    setDone(false);

    const result = await createMuxUpload(lessonId);
    if (result.error || !result.url) {
      setBusy(false);
      setError(result.error ?? "Could not start upload.");
      return;
    }

    try {
      const res = await fetch(result.url, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "video/mp4" },
      });
      if (!res.ok) throw new Error("Upload failed");
      setDone(true);
    } catch {
      setError("Upload failed.");
    }
    setBusy(false);
  }

  return (
    <div className="mt-2">
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
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
        <Upload className="h-3.5 w-3.5" />
        {busy ? "Uploading…" : "Upload video file"}
      </button>
      {done && (
        <p className="mt-1 text-xs text-storm-navy/60">
          Upload received. Playback will appear when Mux finishes processing (webhook).
        </p>
      )}
      {error && <p className="text-xs text-storm-pink">{error}</p>}
    </div>
  );
}
