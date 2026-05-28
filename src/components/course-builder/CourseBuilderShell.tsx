"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { CourseBuilderCourse } from "@/lib/course-builder/types";
import { CourseInfoTab } from "./tabs/CourseInfoTab";
import { CurriculumTab } from "./tabs/CurriculumTab";
import { SettingsTab } from "./tabs/SettingsTab";
import { AssignmentsTab } from "./tabs/AssignmentsTab";
import { PreviewPublishTab } from "./tabs/PreviewPublishTab";
import { AiStudioTab } from "./tabs/AiStudioTab";

const TABS = [
  { id: "info", label: "Course Info" },
  { id: "curriculum", label: "Curriculum" },
  { id: "ai", label: "AI Studio" },
  { id: "settings", label: "Settings" },
  { id: "assignments", label: "Assignments" },
  { id: "preview", label: "Preview & Publish" },
] as const;

export type BuilderTab = (typeof TABS)[number]["id"];

export function CourseBuilderShell({
  course,
  users,
  allowDestructive = true,
}: {
  course: CourseBuilderCourse;
  users: { id: string; email: string; name: string | null; jobRole: string | null }[];
  allowDestructive?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = (searchParams.get("tab") as BuilderTab) || "curriculum";

  function setTab(id: BuilderTab) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", id);
    router.push(`${pathname}?${params.toString()}`);
  }

  const statusLabel =
    course.status === "PUBLISHED"
      ? course.hasUnpublishedChanges
        ? "Unpublished changes"
        : "Published"
      : course.status === "ARCHIVED"
        ? "Archived"
        : "Draft";

  return (
    <div className="min-w-0">
      <div className="mb-4 flex flex-col gap-3 border-b border-storm-light-blue/60 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <Link
            href="/admin/courses"
            className="text-sm text-storm-medium-blue no-underline hover:underline"
          >
            ← Courses
          </Link>
          <h1 className="font-title mt-1 truncate text-xl font-bold text-storm-navy sm:text-2xl">
            Course Builder: {course.title}
          </h1>
          <span
            className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
              course.status === "PUBLISHED"
                ? "bg-green-100 text-green-800"
                : course.status === "ARCHIVED"
                  ? "bg-storm-light-grey text-storm-navy/70"
                  : "bg-amber-100 text-amber-900"
            }`}
          >
            {statusLabel}
          </span>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {allowDestructive && (
            <Link
              href={`/admin/grades/courses/${course.id}`}
              className="inline-flex min-h-10 items-center rounded-lg border border-storm-medium-blue/50 px-4 py-2 text-sm font-medium text-storm-medium-blue no-underline hover:bg-storm-medium-blue/5"
            >
              Learner grades
            </Link>
          )}
          <Link
            href={`/courses/${course.slug}?preview=1`}
            target="_blank"
            className="inline-flex min-h-10 items-center rounded-lg border border-storm-light-blue/60 px-4 py-2 text-sm font-medium text-storm-navy no-underline"
          >
            Preview
          </Link>
        </div>
      </div>

      {course.status === "PUBLISHED" && course.hasUnpublishedChanges && (
        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          This course is published. Changes are saved as draft until you publish again.
        </div>
      )}

      <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-storm-light-blue/40 pb-px">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`shrink-0 min-h-10 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.id
                ? "border-storm-medium-blue text-storm-medium-blue"
                : "border-transparent text-storm-navy/60 hover:text-storm-navy"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "info" && <CourseInfoTab course={course} />}
      {tab === "curriculum" && (
        <CurriculumTab course={course} allowDestructive={allowDestructive} />
      )}
      {tab === "ai" && <AiStudioTab course={course} />}
      {tab === "settings" && <SettingsTab course={course} />}
      {tab === "assignments" && <AssignmentsTab courseId={course.id} users={users} />}
      {tab === "preview" && <PreviewPublishTab course={course} />}
    </div>
  );
}
