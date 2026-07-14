"use client";

import Link from "next/link";
import { getCourseValidation, publishCourse, saveCourseAsDraft } from "@/lib/actions/course-builder";
import type { CourseBuilderCourse } from "@/lib/course-builder/types";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Issue = { level: string; message: string };

export function PreviewPublishTab({ course }: { course: CourseBuilderCourse }) {
  const router = useRouter();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getCourseValidation(course.id).then((r) => {
      setIssues(r.issues);
      setOk(r.ok);
    });
  }, [course.id]);

  async function handlePublish() {
    setBusy(true);
    setError("");
    const result = await publishCourse(course.id);
    setBusy(false);
    if (result?.error) {
      setError(result.error);
      if (result.issues) setIssues(result.issues);
      return;
    }
    router.refresh();
  }

  async function handleDraft() {
    setBusy(true);
    await saveCourseAsDraft(course.id);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="rounded-xl border bg-white p-4 sm:p-6">
        <h2 className="font-medium text-storm-navy">Course validation</h2>
        <ul className="mt-4 space-y-2">
          {issues.length === 0 && (
            <li className="text-sm text-green-700">✓ No issues found. Ready to publish.</li>
          )}
          {issues.map((issue, i) => (
            <li
              key={i}
              className={`text-sm ${
                issue.level === "error" ? "text-red-700" : "text-amber-800"
              }`}
            >
              {issue.level === "error" ? "✗" : "⚠"} {issue.message}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Link
          href={`/courses/${course.slug}?preview=1`}
          target="_blank"
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg border border-storm-light-blue/60 text-sm font-medium text-storm-navy no-underline"
        >
          Preview as trainee
        </Link>
        <button
          type="button"
          onClick={handleDraft}
          disabled={busy}
          className="min-h-11 flex-1 rounded-lg border text-sm font-medium text-storm-navy"
        >
          Save as draft
        </button>
        <button
          type="button"
          onClick={handlePublish}
          disabled={busy || !ok}
          className="min-h-11 flex-1 rounded-lg bg-storm-pink text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Publishing…" : "Publish course"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <p className="text-sm text-storm-navy/60">
        Publishing marks every module, curriculum item, and linked quiz/exam as published. Course
        quizzes stay available inside the course only (not on the general Exams page).
      </p>
      {!ok && (
        <p className="text-sm text-storm-navy/60">Fix all errors before publishing.</p>
      )}
    </div>
  );
}
