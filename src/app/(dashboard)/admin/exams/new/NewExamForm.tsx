"use client";

import { createExam } from "@/lib/actions/exams-admin";
import { UserAssignmentList } from "@/components/ui/UserAssignmentList";
import { useRouter } from "next/navigation";
import { useState } from "react";

const inputClass =
  "w-full min-h-11 rounded-lg border border-storm-light-blue/60 px-3 py-2 text-sm";

export function NewExamForm({
  courses,
  users,
}: {
  courses: { id: string; slug: string; title: string }[];
  users: { id: string; email: string; name: string | null }[];
}) {
  const router = useRouter();
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const assignedIds = new Set(selectedUsers);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const id = await createExam({
      title: fd.get("title") as string,
      description: (fd.get("description") as string) || undefined,
      courseId: (fd.get("courseId") as string) || undefined,
      passingScore: Number(fd.get("passingScore")),
      timeLimitMinutes: Number(fd.get("timeLimitMinutes")),
      attemptsAllowed: Number(fd.get("attemptsAllowed")),
      shuffleQuestions: fd.get("shuffleQuestions") === "on",
      gradeVisibility:
        fd.get("hideGradesUntilPublish") === "on" ? "ADMIN_ONLY" : "LEARNER_VISIBLE",
      userIds: selectedUsers,
    });
    router.push(`/admin/exams/${id}`);
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl space-y-4 rounded-xl border bg-white p-4 sm:p-6">
      <input name="title" required placeholder="Exam title" className={inputClass} />
      <textarea name="description" placeholder="Description" className={inputClass} rows={2} />
      <select name="courseId" className={inputClass}>
        <option value="">Standalone (no course)</option>
        {courses.map((c) => (
          <option key={c.id} value={c.id}>{c.title}</option>
        ))}
      </select>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="text-sm">
          <span className="mb-1 block text-storm-navy/70">Pass %</span>
          <input name="passingScore" type="number" defaultValue={80} className={inputClass} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-storm-navy/70">Minutes</span>
          <input name="timeLimitMinutes" type="number" defaultValue={30} className={inputClass} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-storm-navy/70">Attempts</span>
          <input name="attemptsAllowed" type="number" min={1} defaultValue={3} required className={inputClass} />
        </label>
      </div>
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input type="checkbox" name="shuffleQuestions" className="h-5 w-5" />
        Shuffle questions for learners
      </label>
      <label className="flex min-h-11 items-start gap-3 text-sm">
        <input
          type="checkbox"
          name="hideGradesUntilPublish"
          defaultChecked
          className="mt-0.5 h-5 w-5 shrink-0"
        />
        <span>
          <span className="font-medium text-storm-navy">
            Hold grades until I review and publish them
          </span>
          <span className="mt-1 block text-storm-navy/60">
            Recommended when free-response questions need manual grading. Learners only
            see scores after you publish grades from the exam settings page.
          </span>
        </span>
      </label>
      <div>
        <p className="mb-2 text-sm font-medium">Assign learners</p>
        <UserAssignmentList
          users={users}
          assignedIds={assignedIds}
          onToggle={(userId, checked) => {
            setSelectedUsers((prev) =>
              checked ? [...prev, userId] : prev.filter((id) => id !== userId),
            );
          }}
        />
      </div>
      <button
        type="submit"
        className="min-h-11 w-full rounded-lg bg-storm-medium-blue px-4 py-2.5 text-sm font-semibold text-white sm:w-auto"
      >
        Create exam
      </button>
    </form>
  );
}
