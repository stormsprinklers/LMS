"use client";

import {
  updateExam,
  assignUsersToExam,
  removeExamAssignment,
  publishExamGrades,
  deleteQuestion,
} from "@/lib/actions/exams-admin";
import { ExamCsvTools } from "@/components/exams/ExamCsvTools";
import { ExamDangerZone } from "@/components/exams/ExamDangerZone";
import { QuestionEditor } from "@/components/exams/QuestionEditor";
import { UserAssignmentList } from "@/components/ui/UserAssignmentList";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { EditableQuestion } from "@/components/exams/QuestionEditor";
import type { QuestionType } from "@prisma/client";

type ExamData = {
  id: string;
  title: string;
  description: string | null;
  passingScore: number;
  timeLimitMinutes: number;
  attemptsAllowed: number;
  shuffleQuestions: boolean;
  gradeVisibility: string;
  published: boolean;
  archived: boolean;
  archivedAt: Date | null;
  gradesPublishedAt: Date | null;
  course: { id: string; slug: string; title: string } | null;
  lesson: { id: string; title: string } | null;
  _count: { attempts: number };
  questions: EditableQuestion[];
  assignments: { userId: string; user: { id: string; name: string | null; email: string } }[];
};

const inputClass =
  "w-full min-h-11 rounded-lg border border-storm-light-blue/60 px-3 py-2 text-sm";
const btnPrimary =
  "min-h-11 w-full rounded-lg bg-storm-medium-blue px-4 py-2.5 text-sm font-semibold text-white sm:w-auto";
const btnSecondary =
  "min-h-11 w-full rounded-lg border border-storm-pink px-4 py-2.5 text-sm font-semibold text-storm-pink sm:w-auto";

export function ExamDetailClient({
  exam,
  allUsers,
  allowDestructive = true,
}: {
  exam: ExamData;
  allUsers: { id: string; email: string; name: string | null }[];
  allowDestructive?: boolean;
}) {
  const router = useRouter();
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const assignedIds = new Set(exam.assignments.map((a) => a.userId));

  function toEditableQuestion(
    q: ExamData["questions"][number],
  ): EditableQuestion {
    return {
      ...q,
      type: q.type as QuestionType,
    };
  }

  async function saveSettings(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await updateExam(exam.id, {
      title: fd.get("title") as string,
      description: (fd.get("description") as string) || undefined,
      passingScore: Number(fd.get("passingScore")),
      timeLimitMinutes: Number(fd.get("timeLimitMinutes")),
      attemptsAllowed: Number(fd.get("attemptsAllowed")),
      shuffleQuestions: fd.get("shuffleQuestions") === "on",
      gradeVisibility:
        fd.get("hideGradesUntilPublish") === "on" ? "ADMIN_ONLY" : "LEARNER_VISIBLE",
      published: fd.get("published") === "on",
    });
    router.refresh();
  }

  return (
    <div className="space-y-8 min-w-0">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-storm-medium-blue/30 bg-storm-medium-blue/10 px-4 py-3">
        <p className="text-sm text-storm-navy">
          View scores and submissions for all learners who have taken this exam.
        </p>
        <Link
          href={`/admin/grades/exams/${exam.id}`}
          className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg bg-storm-medium-blue px-4 py-2 text-sm font-semibold text-white no-underline"
        >
          Learner grades →
        </Link>
      </div>

      <form onSubmit={saveSettings} className="w-full space-y-4 rounded-xl border bg-white p-4 sm:p-5">
        <h2 className="font-medium text-storm-navy">Settings</h2>
        <input name="title" defaultValue={exam.title} required placeholder="Title" className={inputClass} />
        <textarea name="description" defaultValue={exam.description ?? ""} className={inputClass} rows={2} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="text-sm">
            <span className="mb-1 block text-storm-navy/70">Pass %</span>
            <input name="passingScore" type="number" defaultValue={exam.passingScore} className={inputClass} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-storm-navy/70">Minutes</span>
            <input name="timeLimitMinutes" type="number" defaultValue={exam.timeLimitMinutes} className={inputClass} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-storm-navy/70">Submissions allowed</span>
            <input
              name="attemptsAllowed"
              type="number"
              min={1}
              required
              defaultValue={exam.attemptsAllowed < 1 ? 3 : exam.attemptsAllowed}
              className={inputClass}
            />
            <span className="mt-1 block text-xs text-storm-navy/50">
              Final submissions per learner (saved progress does not count).
            </span>
          </label>
        </div>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input type="checkbox" name="shuffleQuestions" defaultChecked={exam.shuffleQuestions} className="h-5 w-5" />
          Shuffle questions
        </label>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input type="checkbox" name="published" defaultChecked={exam.published} className="h-5 w-5" />
          Published
        </label>
        <label className="flex min-h-11 items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="hideGradesUntilPublish"
            defaultChecked={exam.gradeVisibility === "ADMIN_ONLY"}
            className="mt-0.5 h-5 w-5 shrink-0"
          />
          <span>
            <span className="font-medium text-storm-navy">
              Hold grades until I review and publish them
            </span>
            <span className="mt-1 block text-storm-navy/60">
              Learners can take the exam when it is published, but will not see scores or
              feedback until you publish grades below. Uncheck to show results automatically
              after each attempt is graded.
            </span>
          </span>
        </label>
        <button type="submit" className={btnPrimary}>Save settings</button>
        {exam.gradeVisibility === "ADMIN_ONLY" && (
          <>
            {exam.gradesPublishedAt ? (
              <p className="text-sm text-emerald-700">
                Grades published to learners{" "}
                {new Date(exam.gradesPublishedAt).toLocaleString()}
              </p>
            ) : (
              <button
                type="button"
                onClick={async () => {
                  await publishExamGrades(exam.id);
                  router.refresh();
                }}
                className={btnSecondary}
              >
                Publish grades to learners
              </button>
            )}
          </>
        )}
        <ExamCsvTools examId={exam.id} />
        {allowDestructive && (
          <ExamDangerZone
            examId={exam.id}
            examTitle={exam.title}
            archived={exam.archived}
            hasLessonLink={!!exam.lesson}
            attemptCount={exam._count.attempts}
          />
        )}
      </form>

      {exam.archived && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          This exam is archived
          {exam.archivedAt
            ? ` since ${new Date(exam.archivedAt).toLocaleString()}`
            : ""}
          . Restore it below to allow access again.
        </p>
      )}

      {allowDestructive && exam.course && (
        <Link
          href={`/admin/courses/${exam.course.slug}/admins`}
          className="inline-flex min-h-11 items-center text-sm font-medium text-storm-medium-blue no-underline"
        >
          Manage course admins →
        </Link>
      )}

      <div className="w-full rounded-xl border bg-white p-4 sm:p-5">
        <h2 className="font-medium text-storm-navy mb-3">Learner assignments</h2>
        <UserAssignmentList
          users={allUsers}
          assignedIds={assignedIds}
          onToggle={async (userId, checked) => {
            if (checked) await assignUsersToExam(exam.id, [userId]);
            else await removeExamAssignment(exam.id, userId);
            router.refresh();
          }}
        />
      </div>

      <QuestionEditor
        examId={exam.id}
        nextSortOrder={exam.questions.length}
        onSaved={() => router.refresh()}
      />

      <div>
        <h2 className="font-medium text-storm-navy mb-3">
          Questions ({exam.questions.length})
        </h2>
        <ul className="space-y-4">
          {exam.questions.map((q, i) =>
            editingQuestionId === q.id ? (
              <li key={q.id}>
                <QuestionEditor
                  examId={exam.id}
                  nextSortOrder={q.sortOrder}
                  question={toEditableQuestion(q)}
                  onCancel={() => setEditingQuestionId(null)}
                  onSaved={() => {
                    setEditingQuestionId(null);
                    router.refresh();
                  }}
                />
              </li>
            ) : (
              <li key={q.id} className="rounded-xl border bg-white p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-start">
                  <p className="min-w-0 font-medium text-storm-navy break-words">
                    {i + 1}. [{q.type.replace(/_/g, " ")}] {q.text}
                  </p>
                  <div className="flex shrink-0 gap-3">
                    <button
                      type="button"
                      onClick={() => setEditingQuestionId(q.id)}
                      className="min-h-11 text-sm font-medium text-storm-medium-blue"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (
                          !confirm(
                            "Delete this question? This cannot be undone.",
                          )
                        ) {
                          return;
                        }
                        await deleteQuestion(exam.id, q.id);
                        router.refresh();
                      }}
                      className="min-h-11 text-sm text-red-600"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                {q.options.length > 0 && (
                  <ul className="mt-2 text-sm text-storm-navy/70">
                    {q.options.map((o) => (
                      <li key={o.id}>
                        {o.isCorrect ? "✓ " : ""}
                        {o.text}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ),
          )}
        </ul>
      </div>
    </div>
  );
}
