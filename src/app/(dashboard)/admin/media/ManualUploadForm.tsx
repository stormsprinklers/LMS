"use client";

import { uploadManualPdf } from "@/lib/actions/media";
import { useState } from "react";

export function ManualUploadForm({ manualId }: { manualId: string }) {
  const [status, setStatus] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("manualId", manualId);
    const result = await uploadManualPdf(fd);
    setStatus(result.error ?? "Uploaded successfully.");
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input type="file" name="file" accept="application/pdf" required />
      <button type="submit" className="rounded bg-storm-navy px-3 py-1 text-sm text-white">
        Upload PDF
      </button>
      {status && <span className="text-sm text-storm-navy/70">{status}</span>}
    </form>
  );
}
