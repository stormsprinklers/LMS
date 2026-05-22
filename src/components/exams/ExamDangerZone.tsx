"use client";

import { archiveExam, deleteExam, restoreExam } from "@/lib/actions/exams-admin";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function ExamDangerZone({
  examId,
  examTitle,
  archived,
  hasLessonLink,
  attemptCount,
}: {
  examId: string;
  examTitle: string;
  archived: boolean;
  hasLessonLink: boolean;
  attemptCount: number;
}) {
  const router = useRouter();
  const [confirm, setConfirm] = useState<"archive" | "delete" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleArchive() {
    setBusy(true);
    setError("");
    await archiveExam(examId);
    setBusy(false);
    setConfirm(null);
    router.refresh();
  }

  async function handleRestore() {
    setBusy(true);
    setError("");
    await restoreExam(examId);
    setBusy(false);
    router.refresh();
  }

  async function handleDelete() {
    setBusy(true);
    setError("");
    const result = await deleteExam(examId);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.push("/admin/exams");
  }

  return (
    <div className="rounded-xl border border-red-200 bg-red-50/50 p-4 sm:p-5 space-y-4">
      <div>
        <h3 className="font-medium text-storm-navy">Archive or delete</h3>
        {archived ? (
          <p className="mt-1 text-sm text-storm-navy/70">
            This exam is archived. Learners cannot access it. Restore it to make it
            available again, or delete it permanently.
          </p>
        ) : (
          <p className="mt-1 text-sm text-storm-navy/70">
            Archive hides the exam from learners and unpublishes it while keeping all
            questions and attempt history. Delete permanently removes the exam and its
            data.
          </p>
        )}
        {hasLessonLink && (
          <p className="mt-2 text-sm text-amber-800">
            Linked to a course lesson — deleting only removes the exam record, not the
            lesson.
          </p>
        )}
        {attemptCount > 0 && !archived && (
          <p className="mt-2 text-sm text-storm-navy/60">
            {attemptCount} learner attempt{attemptCount === 1 ? "" : "s"} on record.
          </p>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {confirm === "archive" && (
        <div className="rounded-lg border border-amber-300 bg-white p-4 space-y-3">
          <p className="text-sm text-storm-navy">
            Archive <strong>{examTitle}</strong>? Learners will no longer see or take
            this exam.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={busy}
              onClick={handleArchive}
              className="min-h-11 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Archiving…" : "Confirm archive"}
            </button>
            <button
              type="button"
              onClick={() => setConfirm(null)}
              className="min-h-11 rounded-lg border px-4 py-2 text-sm text-storm-navy"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {confirm === "delete" && (
        <div className="rounded-lg border border-red-300 bg-white p-4 space-y-3">
          <p className="text-sm text-storm-navy">
            Permanently delete <strong>{examTitle}</strong>? This cannot be undone.
            {attemptCount > 0 && (
              <> All {attemptCount} attempt{attemptCount === 1 ? "" : "s"} will be lost.</>
            )}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={busy}
              onClick={handleDelete}
              className="min-h-11 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Deleting…" : "Confirm delete"}
            </button>
            <button
              type="button"
              onClick={() => setConfirm(null)}
              className="min-h-11 rounded-lg border px-4 py-2 text-sm text-storm-navy"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {!confirm && (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {archived ? (
            <button
              type="button"
              disabled={busy}
              onClick={handleRestore}
              className="min-h-11 rounded-lg border border-storm-medium-blue bg-white px-4 py-2 text-sm font-semibold text-storm-medium-blue disabled:opacity-50"
            >
              {busy ? "Restoring…" : "Restore exam"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setConfirm("archive")}
              className="min-h-11 rounded-lg border border-amber-500 bg-white px-4 py-2 text-sm font-semibold text-amber-800"
            >
              Archive exam
            </button>
          )}
          <button
            type="button"
            onClick={() => setConfirm("delete")}
            className="min-h-11 rounded-lg border border-red-400 bg-white px-4 py-2 text-sm font-semibold text-red-700"
          >
            Delete permanently
          </button>
        </div>
      )}
    </div>
  );
}
