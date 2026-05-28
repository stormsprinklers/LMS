"use client";

import { uploadManualPdf } from "@/lib/actions/media";
import { FileInput } from "@/components/ui/FileInput";
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
    <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-3">
      <FileInput name="file" accept="application/pdf" required />
      <button
        type="submit"
        className="min-h-11 rounded-lg bg-storm-navy px-4 py-2 text-sm font-semibold text-white"
      >
        Upload PDF
      </button>
      {status && <span className="text-sm text-storm-navy/70">{status}</span>}
    </form>
  );
}
