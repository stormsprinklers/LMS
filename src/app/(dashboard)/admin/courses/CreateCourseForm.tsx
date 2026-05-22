"use client";

import { createCourse } from "@/lib/actions/admin";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function CreateCourseForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await createCourse({
      slug: (fd.get("slug") as string).trim(),
      title: fd.get("title") as string,
      description: fd.get("description") as string,
      category: fd.get("category") as string,
      estimatedHours: Number(fd.get("estimatedHours")),
    });
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-storm-pink px-4 py-2 text-sm font-semibold text-white"
      >
        + New course
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3 rounded-xl border bg-white p-4">
      <input name="title" placeholder="Title" required className="w-full rounded border px-3 py-2" />
      <input name="slug" placeholder="slug-url" required className="w-full rounded border px-3 py-2" />
      <textarea name="description" placeholder="Description" required className="w-full rounded border px-3 py-2" />
      <input name="category" placeholder="Category" required className="w-full rounded border px-3 py-2" />
      <input name="estimatedHours" type="number" step="0.5" placeholder="Hours" required className="w-full rounded border px-3 py-2" />
      <div className="flex gap-2">
        <button type="submit" className="rounded-lg bg-storm-medium-blue px-4 py-2 text-sm text-white">
          Create
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-storm-navy/60">
          Cancel
        </button>
      </div>
    </form>
  );
}
