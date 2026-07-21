"use client";

import { createLesson } from "@/lib/actions/admin";
import { useRouter } from "next/navigation";

const inputClass =
  "w-full min-h-11 rounded-lg border border-storm-light-blue/60 px-3 py-2 text-sm";

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
    <form onSubmit={handleSubmit} className="grid w-full gap-3 rounded-xl border bg-white p-4 sm:grid-cols-2">
      <input name="title" placeholder="Lesson title" required className={inputClass} />
      <input name="slug" placeholder="slug" required className={inputClass} />
      <select name="type" className={inputClass}>
        <option value="VIDEO">Video</option>
        <option value="MANUAL">Manual</option>
        <option value="EXAM">Exam</option>
      </select>
      <input name="durationMinutes" type="number" placeholder="Duration (min)" className={inputClass} />
      <button
        type="submit"
        className="min-h-11 rounded-lg bg-storm-medium-blue px-4 py-2.5 text-sm font-semibold text-white sm:col-span-2"
      >
        Add lesson
      </button>
    </form>
  );
}
