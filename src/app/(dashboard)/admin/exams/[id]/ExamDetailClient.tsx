"use client";

import {
  updateExam,
  assignUsersToExam,
  removeExamAssignment,
  publishExamGrades,
  deleteQuestion,
} from "@/lib/actions/exams-admin";
import { QuestionEditor } from "@/components/exams/QuestionEditor";
import { UserAssignmentList } from "@/components/ui/UserAssignmentList";
import Link from "next/link";
import { useRouter } from "next/navigation";

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
  gradesPublishedAt: Date | null;
  course: { id: string; slug: string; title: string } | null;
  questions: {
    id: string;
    type: string;
    text: string;
    sortOrder: number;
    config: unknown;
    options: { id: string; text: string; isCorrect: boolean }[];
  }[];
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
}: {
  exam: ExamData;
  allUsers: { id: string; email: string; name: string | null }[];
}) {
  const router = useRouter();
  const assignedIds = new Set(exam.assignments.map((a) => a.userId));

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
        fd.get("gradeVisibility") === "LEARNER_VISIBLE" ? "LEARNER_VISIBLE" : "ADMIN_ONLY",
      published: fd.get("published") === "on",
    });
    router.refresh();
  }

  return (
    <div className="space-y-8 min-w-0">
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
            <span className="mb-1 block text-storm-navy/70">Attempts</span>
            <input name="attemptsAllowed" type="number" defaultValue={exam.attemptsAllowed} className={inputClass} />
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
        <select name="gradeVisibility" defaultValue={exam.gradeVisibility} className={inputClass}>
          <option value="ADMIN_ONLY">Admin only until publish</option>
          <option value="LEARNER_VISIBLE">Learner visible after publish</option>
        </select>
        <button type="submit" className={btnPrimary}>Save settings</button>
        {exam.gradesPublishedAt ? (
          <p className="text-sm text-emerald-700">
            Grades published {new Date(exam.gradesPublishedAt).toLocaleString()}
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
      </form>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3">
        <Link href={`/admin/exams/${exam.id}/import`} className="min-h-11 text-sm text-storm-medium-blue no-underline flex items-center">
          CSV import
        </Link>
        <a href={`/api/admin/exams/${exam.id}/export`} className="min-h-11 text-sm text-storm-medium-blue no-underline flex items-center">
          Export CSV
        </a>
        {exam.course && (
          <Link
            href={`/admin/courses/${exam.course.slug}/admins`}
            className="min-h-11 text-sm text-storm-medium-blue no-underline flex items-center"
          >
            Course admins
          </Link>
        )}
      </div>

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

      <QuestionEditor examId={exam.id} nextSortOrder={exam.questions.length} />

      <ul className="space-y-4">
        {exam.questions.map((q, i) => (
          <li key={q.id} className="rounded-xl border bg-white p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
              <p className="min-w-0 font-medium text-storm-navy break-words">
                {i + 1}. [{q.type}] {q.text}
              </p>
              <button
                type="button"
                onClick={async () => {
                  await deleteQuestion(exam.id, q.id);
                  router.refresh();
                }}
                className="min-h-11 shrink-0 text-sm text-red-600 sm:text-xs"
              >
                Delete
              </button>
            </div>
            {q.options.length > 0 && (
              <ul className="mt-2 text-sm text-storm-navy/70">
                {q.options.map((o) => (
                  <li key={o.id}>{o.isCorrect ? "✓ " : ""}{o.text}</li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
