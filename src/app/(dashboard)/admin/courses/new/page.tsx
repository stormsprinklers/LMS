"use client";

import { createCourseDraft } from "@/lib/actions/course-builder";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NewCoursePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const result = await createCourseDraft({ title });
    setBusy(false);
    if (result?.courseId) {
      router.push(`/admin/courses/${result.courseId}/builder`);
    }
  }

  return (
    <div className="mx-auto max-w-lg rounded-xl border bg-white p-6">
      <h1 className="font-title text-xl font-bold text-storm-navy">Create course</h1>
      <p className="mt-1 text-sm text-storm-navy/60">
        Start with a title — you can add modules and lessons in the builder.
      </p>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <label className="block text-sm">
          Course title
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="mt-1 w-full min-h-11 rounded-lg border border-storm-light-blue/60 px-3 py-2"
            placeholder="Irrigation Technician Foundations"
          />
        </label>
        <button
          type="submit"
          disabled={busy || !title.trim()}
          className="min-h-11 w-full rounded-lg bg-storm-pink text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Creating…" : "Create & open builder"}
        </button>
      </form>
    </div>
  );
}
