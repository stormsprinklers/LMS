"use client";

import { updateCourseInfo } from "@/lib/actions/course-builder";
import type { CourseBuilderCourse } from "@/lib/course-builder/types";
import type { CourseDifficulty } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SaveStateBadge } from "../SaveStateBadge";

const inputClass =
  "mt-1 w-full min-h-11 rounded-lg border border-storm-light-blue/60 px-3 py-2 text-sm";

export function CourseInfoTab({ course }: { course: CourseBuilderCourse }) {
  const router = useRouter();
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaveState("saving");
    setError("");
    const fd = new FormData(e.currentTarget);
    const tags = String(fd.get("tags") ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    try {
      const result = await updateCourseInfo(course.id, {
        title: String(fd.get("title")),
        slug: String(fd.get("slug")),
        shortDescription: String(fd.get("shortDescription") || ""),
        description: String(fd.get("description")),
        category: String(fd.get("category")),
        difficulty: String(fd.get("difficulty")) as CourseDifficulty,
        estimatedMinutes: Number(fd.get("estimatedMinutes")) || 60,
        thumbnailUrl: String(fd.get("thumbnailUrl") || "") || undefined,
        tags,
        internalNotes: String(fd.get("internalNotes") || "") || undefined,
      });
      setSaveState("saved");
      router.refresh();
    } catch {
      setError("Failed to save");
      setSaveState("error");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-4 rounded-xl border bg-white p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-medium text-storm-navy">Course details</h2>
        <SaveStateBadge state={saveState} />
      </div>
      <label className="block text-sm">
        Title
        <input name="title" defaultValue={course.title} required className={inputClass} />
      </label>
      <label className="block text-sm">
        URL slug
        <input name="slug" defaultValue={course.slug} required className={inputClass} />
      </label>
      <label className="block text-sm">
        Short description
        <input
          name="shortDescription"
          defaultValue={course.shortDescription ?? ""}
          className={inputClass}
        />
      </label>
      <label className="block text-sm">
        Full description
        <textarea
          name="description"
          rows={4}
          defaultValue={course.description}
          className={inputClass}
        />
      </label>
      <label className="block text-sm">
        Category
        <input name="category" defaultValue={course.category} className={inputClass} />
      </label>
      <label className="block text-sm">
        Difficulty
        <select name="difficulty" defaultValue={course.difficulty} className={inputClass}>
          <option value="BEGINNER">Beginner</option>
          <option value="INTERMEDIATE">Intermediate</option>
          <option value="ADVANCED">Advanced</option>
        </select>
      </label>
      <label className="block text-sm">
        Estimated duration (minutes)
        <input
          name="estimatedMinutes"
          type="number"
          min={1}
          defaultValue={course.estimatedMinutes ?? Math.round(course.estimatedHours * 60)}
          className={inputClass}
        />
      </label>
      <label className="block text-sm">
        Thumbnail URL
        <input name="thumbnailUrl" defaultValue={course.thumbnailUrl ?? ""} className={inputClass} />
      </label>
      <label className="block text-sm">
        Tags (comma-separated)
        <input name="tags" defaultValue={course.tags.join(", ")} className={inputClass} />
      </label>
      <label className="block text-sm">
        Internal notes
        <textarea
          name="internalNotes"
          rows={2}
          defaultValue={course.internalNotes ?? ""}
          className={inputClass}
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        className="min-h-11 rounded-lg bg-storm-medium-blue px-6 py-2.5 text-sm font-semibold text-white"
      >
        Save course info
      </button>
    </form>
  );
}
