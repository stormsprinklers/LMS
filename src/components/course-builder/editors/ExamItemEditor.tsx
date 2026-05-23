"use client";

import Link from "next/link";
import { updateCourseItem } from "@/lib/actions/course-builder";
import { updateExam } from "@/lib/actions/exams-admin";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ContentStatus } from "@prisma/client";

const inputClass =
  "mt-1 w-full min-h-10 rounded-lg border border-storm-light-blue/60 px-3 py-2 text-sm";

type Item = {
  id: string;
  title: string;
  isRequired: boolean;
  estimatedMinutes: number | null;
  status: ContentStatus;
  examId: string | null;
  exam: {
    id: string;
    title: string;
    passingScore: number;
    timeLimitMinutes: number;
    attemptsAllowed: number;
    _count?: { questions: number };
  } | null;
};

export function ExamItemEditor({ item }: { item: Item }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const examId = item.examId ?? item.exam?.id;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    await updateCourseItem(item.id, {
      title: String(fd.get("title")),
      isRequired: fd.get("isRequired") === "on",
      estimatedMinutes: Number(fd.get("estimatedMinutes")) || undefined,
      status: String(fd.get("status")) as ContentStatus,
    });
    if (examId) {
      await updateExam(examId, {
        attemptsAllowed: Number(fd.get("attemptsAllowed")),
        passingScore: Number(fd.get("passingScore")),
        timeLimitMinutes: Number(fd.get("timeLimitMinutes")),
      });
    }
    setBusy(false);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <label className="block text-sm">
        Display title (in curriculum)
        <input name="title" defaultValue={item.title} required className={inputClass} />
      </label>
      {examId && (
        <div className="space-y-3 rounded-lg border border-storm-light-blue/40 bg-storm-light-grey/30 p-3">
          <p className="text-sm font-medium text-storm-navy">Exam settings</p>
          <p className="text-xs text-storm-navy/60">
            {item.exam?.title ?? "Linked exam"} ·{" "}
            {item.exam?._count?.questions ?? 0} questions
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="block text-sm">
              Pass %
              <input
                name="passingScore"
                type="number"
                min={0}
                max={100}
                defaultValue={item.exam?.passingScore ?? 80}
                className={inputClass}
              />
            </label>
            <label className="block text-sm">
              Time limit (min)
              <input
                name="timeLimitMinutes"
                type="number"
                min={1}
                defaultValue={item.exam?.timeLimitMinutes ?? 30}
                className={inputClass}
              />
            </label>
            <label className="block text-sm">
              Submissions allowed
              <input
                name="attemptsAllowed"
                type="number"
                min={1}
                required
                defaultValue={
                  item.exam?.attemptsAllowed && item.exam.attemptsAllowed >= 1
                    ? item.exam.attemptsAllowed
                    : 3
                }
                className={inputClass}
              />
            </label>
          </div>
          <p className="text-xs text-storm-navy/60">
            How many times each learner may submit this exam for a final score.
          </p>
          <Link
            href={`/admin/exams/${examId}`}
            className="inline-block text-sm font-medium text-storm-medium-blue no-underline hover:underline"
          >
            Open full exam builder (questions, assignments) →
          </Link>
        </div>
      )}
      <label className="block text-sm">
        Estimated minutes
        <input
          name="estimatedMinutes"
          type="number"
          min={0}
          defaultValue={item.estimatedMinutes ?? ""}
          className={inputClass}
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isRequired" defaultChecked={item.isRequired} className="h-4 w-4" />
        Required
      </label>
      <label className="block text-sm">
        Status
        <select name="status" defaultValue={item.status} className={inputClass}>
          <option value="DRAFT">Draft</option>
          <option value="PUBLISHED">Published</option>
        </select>
      </label>
      <button
        type="submit"
        disabled={busy}
        className="min-h-10 w-full rounded-lg bg-storm-medium-blue text-sm font-semibold text-white"
      >
        {busy ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
