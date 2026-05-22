"use client";

import { createLesson } from "@/lib/actions/admin";
import { useRouter } from "next/navigation";

export function AddLessonForm({ moduleId }: { moduleId: string }) {
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await createLesson({
      moduleId,
      slug: (fd.get("slug") as string).trim(),
      title: fd.get("title") as string,
      type: fd.get("type") as "VIDEO" | "MANUAL" | "EXAM",
      durationMinutes: Number(fd.get("durationMinutes")) || undefined,
    });
    (e.target as HTMLFormElement).reset();
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap gap-2 rounded-xl border bg-white p-4">
      <input name="title" placeholder="Lesson title" required className="rounded border px-2 py-1" />
      <input name="slug" placeholder="slug" required className="rounded border px-2 py-1" />
      <select name="type" className="rounded border px-2 py-1">
        <option value="VIDEO">Video</option>
        <option value="MANUAL">Manual</option>
        <option value="EXAM">Exam</option>
      </select>
      <input name="durationMinutes" type="number" placeholder="Min" className="w-20 rounded border px-2 py-1" />
      <button type="submit" className="rounded bg-storm-medium-blue px-3 py-1 text-sm text-white">
        Add lesson
      </button>
    </form>
  );
}
