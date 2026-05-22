"use client";

import { createCourse } from "@/lib/actions/admin";
import { useRouter } from "next/navigation";
import { useState } from "react";

const inputClass =
  "w-full min-h-11 rounded-lg border border-storm-light-blue/60 px-3 py-2 text-sm";

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
        className="min-h-11 w-full rounded-lg bg-storm-pink px-4 py-2.5 text-sm font-semibold text-white sm:w-auto"
      >
        + New course
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 w-full space-y-3 rounded-xl border bg-white p-4">
      <input name="title" placeholder="Title" required className={inputClass} />
      <input name="slug" placeholder="slug-url" required className={inputClass} />
      <textarea name="description" placeholder="Description" required className={inputClass} rows={3} />
      <input name="category" placeholder="Category" required className={inputClass} />
      <input name="estimatedHours" type="number" step="0.5" placeholder="Hours" required className={inputClass} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="submit" className="min-h-11 rounded-lg bg-storm-medium-blue px-4 py-2.5 text-sm text-white">
          Create
        </button>
        <button type="button" onClick={() => setOpen(false)} className="min-h-11 text-sm text-storm-navy/60">
          Cancel
        </button>
      </div>
    </form>
  );
}
