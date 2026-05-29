"use client";

import {
  archiveCourse,
  restoreCourse,
  deleteCourse,
  getCourseDeletePreviewAction,
  archiveUser,
  restoreUser,
  deleteUser,
  archiveCertificationRule,
  restoreCertificationRule,
  deleteCertificationRule,
  archiveManual,
  restoreManual,
  deleteManual,
  archiveLesson,
  restoreLesson,
  deleteLesson,
  archiveGradingAttempt,
  restoreGradingAttempt,
  deleteGradingAttempt,
} from "@/lib/actions/admin-entity";
import {
  archiveExam,
  restoreExam,
  deleteExam,
} from "@/lib/actions/exams-admin";
import type { CourseDeletePreview } from "@/lib/admin/course-delete";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export type AdminEntityType =
  | "course"
  | "exam"
  | "user"
  | "certificationRule"
  | "manual"
  | "lesson"
  | "gradingAttempt";

const redirectAfterDelete: Record<AdminEntityType, string> = {
  course: "/admin/courses",
  exam: "/admin/exams",
  user: "/admin/users",
  certificationRule: "/admin/certifications",
  manual: "/admin/media",
  lesson: "/admin/media",
  gradingAttempt: "/admin/grading",
};

export function AdminEntityActions({
  type,
  id,
  name,
  archived = false,
  compact = false,
  allowDestructive = true,
}: {
  type: AdminEntityType;
  id: string;
  name: string;
  archived?: boolean;
  /** Smaller buttons for list rows */
  compact?: boolean;
  /** Managers cannot archive or delete */
  allowDestructive?: boolean;
}) {
  if (!allowDestructive) return null;
  const router = useRouter();
  const [confirm, setConfirm] = useState<"archive" | "delete" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [courseDeletePreview, setCourseDeletePreview] = useState<CourseDeletePreview | null>(
    null,
  );
  const [courseDeletePreviewLoading, setCourseDeletePreviewLoading] = useState(false);
  const [deleteCourseExams, setDeleteCourseExams] = useState(false);
  const [deleteCourseLibraryMedia, setDeleteCourseLibraryMedia] = useState(false);

  useEffect(() => {
    if (type !== "course" || confirm !== "delete") {
      setCourseDeletePreview(null);
      setDeleteCourseExams(false);
      setDeleteCourseLibraryMedia(false);
      return;
    }

    let cancelled = false;
    setCourseDeletePreviewLoading(true);
    void getCourseDeletePreviewAction(id).then((preview) => {
      if (cancelled) return;
      setCourseDeletePreview(preview);
      setCourseDeletePreviewLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [type, confirm, id]);

  function resetConfirm() {
    setConfirm(null);
    setCourseDeletePreview(null);
    setDeleteCourseExams(false);
    setDeleteCourseLibraryMedia(false);
    setError("");
  }

  async function runArchive() {
    setBusy(true);
    setError("");
    try {
      switch (type) {
        case "course":
          await archiveCourse(id);
          break;
        case "exam":
          await archiveExam(id);
          break;
        case "user":
          await archiveUser(id);
          break;
        case "certificationRule":
          await archiveCertificationRule(id);
          break;
        case "manual":
          await archiveManual(id);
          break;
        case "lesson":
          await archiveLesson(id);
          break;
        case "gradingAttempt":
          await archiveGradingAttempt(id);
          break;
      }
      resetConfirm();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    }
    setBusy(false);
  }

  async function runRestore() {
    setBusy(true);
    setError("");
    try {
      switch (type) {
        case "course":
          await restoreCourse(id);
          break;
        case "exam":
          await restoreExam(id);
          break;
        case "user":
          await restoreUser(id);
          break;
        case "certificationRule":
          await restoreCertificationRule(id);
          break;
        case "manual":
          await restoreManual(id);
          break;
        case "lesson":
          await restoreLesson(id);
          break;
        case "gradingAttempt":
          await restoreGradingAttempt(id);
          break;
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    }
    setBusy(false);
  }

  async function runDelete() {
    setBusy(true);
    setError("");
    try {
      let result: { error?: string; success?: boolean } | undefined;
      switch (type) {
        case "course":
          result = await deleteCourse(id, {
            deleteExams: deleteCourseExams,
            deleteLibraryMedia: deleteCourseLibraryMedia,
          });
          break;
        case "exam":
          result = await deleteExam(id);
          break;
        case "user":
          result = await deleteUser(id);
          break;
        case "certificationRule":
          result = await deleteCertificationRule(id);
          break;
        case "manual":
          result = await deleteManual(id);
          break;
        case "lesson":
          result = await deleteLesson(id);
          break;
        case "gradingAttempt":
          result = await deleteGradingAttempt(id);
          break;
      }
      if (result?.error) {
        setError(result.error);
        setBusy(false);
        return;
      }
      resetConfirm();
      router.push(redirectAfterDelete[type]);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
    setBusy(false);
  }

  const btn =
    "min-h-9 rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-50";

  if (confirm) {
    return (
      <div className="rounded-lg border border-storm-light-blue/60 bg-white p-3 space-y-2">
        <p className="text-sm text-storm-navy">
          {confirm === "archive" ? (
            <>
              Archive <strong>{name}</strong>? It will be hidden from learners and active
              admin lists.
            </>
          ) : (
            <>
              Permanently delete <strong>{name}</strong>? This cannot be undone.
            </>
          )}
        </p>
        {confirm === "delete" && type === "course" && (
          <div className="space-y-3 rounded-lg border border-storm-light-blue/50 bg-storm-light-grey/20 p-3">
            {courseDeletePreviewLoading ? (
              <p className="text-xs text-storm-navy/60">Checking linked content…</p>
            ) : (
              <>
                {(courseDeletePreview?.exams.length ?? 0) > 0 && (
                  <label className="flex cursor-pointer items-start gap-2 text-sm text-storm-navy">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 shrink-0"
                      checked={deleteCourseExams}
                      onChange={(e) => setDeleteCourseExams(e.target.checked)}
                      disabled={busy}
                    />
                    <span>
                      Also delete{" "}
                      <strong>{courseDeletePreview!.exams.length}</strong> linked exam
                      {courseDeletePreview!.exams.length === 1 ? "" : "s"} from the library
                      <span className="mt-1 block text-xs text-storm-navy/60">
                        {courseDeletePreview!.exams
                          .slice(0, 4)
                          .map((e) => e.title)
                          .join(" · ")}
                        {courseDeletePreview!.exams.length > 4
                          ? ` · +${courseDeletePreview!.exams.length - 4} more`
                          : ""}
                      </span>
                    </span>
                  </label>
                )}
                {(courseDeletePreview?.libraryMedia.length ?? 0) > 0 && (
                  <label className="flex cursor-pointer items-start gap-2 text-sm text-storm-navy">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 shrink-0"
                      checked={deleteCourseLibraryMedia}
                      onChange={(e) => setDeleteCourseLibraryMedia(e.target.checked)}
                      disabled={busy}
                    />
                    <span>
                      Also delete{" "}
                      <strong>{courseDeletePreview!.libraryMedia.length}</strong> photo/video
                      {courseDeletePreview!.libraryMedia.length === 1 ? "" : "s"} synced from this
                      course
                      <span className="mt-1 block text-xs text-storm-navy/60">
                        {courseDeletePreview!.libraryMedia
                          .slice(0, 4)
                          .map((a) => a.title)
                          .join(" · ")}
                        {courseDeletePreview!.libraryMedia.length > 4
                          ? ` · +${courseDeletePreview!.libraryMedia.length - 4} more`
                          : ""}
                      </span>
                    </span>
                  </label>
                )}
                {!courseDeletePreviewLoading &&
                  (courseDeletePreview?.exams.length ?? 0) === 0 &&
                  (courseDeletePreview?.libraryMedia.length ?? 0) === 0 && (
                    <p className="text-xs text-storm-navy/60">
                      No linked exams or library photos/videos were found for this course.
                    </p>
                  )}
              </>
            )}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={confirm === "archive" ? runArchive : runDelete}
            className={`${btn} ${
              confirm === "archive"
                ? "border-amber-500 text-amber-800"
                : "border-red-500 text-red-700"
            }`}
          >
            {busy ? "Working…" : confirm === "archive" ? "Yes, archive" : "Yes, delete"}
          </button>
          <button
            type="button"
            onClick={resetConfirm}
            className={`${btn} border-storm-light-blue/60 text-storm-navy`}
          >
            Cancel
          </button>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className={compact ? "flex flex-wrap gap-2" : "space-y-2"}>
      {archived ? (
        <button
          type="button"
          disabled={busy}
          onClick={runRestore}
          className={`${btn} border-storm-medium-blue text-storm-medium-blue`}
        >
          {busy ? "…" : "Restore"}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setConfirm("archive")}
          className={`${btn} border-amber-500 text-amber-800`}
        >
          Archive
        </button>
      )}
      <button
        type="button"
        onClick={() => setConfirm("delete")}
        className={`${btn} border-red-400 text-red-700`}
      >
        Delete
      </button>
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </div>
  );
}
