"use client";

import { createMuxUpload } from "@/lib/actions/media";
import { useState } from "react";

export function VideoUploadForm({ lessonId }: { lessonId: string }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  async function handleClick() {
    const result = await createMuxUpload(lessonId);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.url) {
      setUrl(result.url);
      window.open(result.url, "_blank");
    }
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={handleClick}
        className="text-sm text-storm-medium-blue hover:underline"
      >
        Create Mux upload URL
      </button>
      {url && (
        <p className="mt-1 break-all text-xs text-storm-navy/60">
          Upload via Mux dashboard or direct upload URL (opens in new tab).
        </p>
      )}
      {error && <p className="text-xs text-storm-pink">{error}</p>}
    </div>
  );
}
