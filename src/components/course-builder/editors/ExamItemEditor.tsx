"use client";

import Link from "next/link";
import {
  linkCourseItemToExam,
  listLinkableExams,
  updateCourseItem,
} from "@/lib/actions/course-builder";
import { updateExam } from "@/lib/actions/exams-admin";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useRef } from "react";
import { useBuilderFormDirty } from "../useBuilderFormDirty";
import type { ContentStatus } from "@prisma/client";

const inputClass =
  "mt-1 w-full min-h-10 rounded-lg border border-storm-light-blue/60 px-3 py-2 text-sm";

type Item = {
  id: string;
  courseId: string;
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
  const formRef = useRef<HTMLFormElement>(null);
  const { resolveSave, formDirtyProps } = useBuilderFormDirty(`exam-${item.id}`, formRef);
  const [busy, setBusy] = useState(false);
  const [linking, setLinking] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const [linkables, setLinkables] = useState<
    Array<{ id: string; title: string; _count: { questions: number } }>
  >([]);
  const [linkExamId, setLinkExamId] = useState("");
  const examId = item.examId ?? item.exam?.id;

  useEffect(() => {
    if (!showLink) return;
    let cancelled = false;
    void listLinkableExams(item.courseId).then((rows) => {
      if (cancelled) return;
      // Include the currently linked exam in the selector
      const merged = [...rows];
      if (item.exam && !merged.some((r) => r.id === item.exam!.id)) {
        merged.unshift({
          id: item.exam.id,
          title: item.exam.title,
          courseId: item.courseId,
          published: true,
          _count: { questions: item.exam._count?.questions ?? 0 },
          course: null,
        });
      }
      setLinkables(merged);
      setLinkExamId(item.examId ?? "");
    });
    return () => {
      cancelled = true;
    };
  }, [showLink, item.courseId, item.exam, item.examId]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    try {
      const title = String(fd.get("title"));
      await updateCourseItem(item.id, {
        title,
        isRequired: fd.get("isRequired") === "on",
        estimatedMinutes: Number(fd.get("estimatedMinutes")) || undefined,
        status: String(fd.get("status")) as ContentStatus,
        syncExamTitle: true,
      });
      if (examId) {
        await updateExam(examId, {
          attemptsAllowed: Number(fd.get("attemptsAllowed")),
          passingScore: Number(fd.get("passingScore")),
          timeLimitMinutes: Number(fd.get("timeLimitMinutes")),
        });
      }
      resolveSave(true);
      router.refresh();
    } catch {
      resolveSave(false);
    } finally {
      setBusy(false);
    }
  }

  async function handleLinkExisting() {
    if (!linkExamId) return;
    setLinking(true);
    try {
      const result = await linkCourseItemToExam(item.id, linkExamId);
      if (result && "error" in result && result.error) {
        window.alert(result.error);
        return;
      }
      setShowLink(false);
      router.refresh();
    } finally {
      setLinking(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} {...formDirtyProps} className="space-y-3">
      <div
        className={`rounded-lg border p-3 ${
          examId
            ? "border-storm-light-blue/50 bg-storm-light-grey/40"
            : "border-amber-200 bg-amber-50"
        }`}
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-storm-navy/60">
          Linked quiz
        </p>
        {examId ? (
          <div className="mt-1 space-y-1">
            <p className="text-sm font-medium text-storm-navy">
              {item.exam?.title ?? item.title ?? "Linked quiz"}
            </p>
            <p className="text-xs text-storm-navy/60">
              {item.exam?._count?.questions ?? 0} questions
              {item.exam && item.exam.title !== item.title
                ? ` · Curriculum item title: “${item.title}”`
                : null}
            </p>
            <Link
              href={`/admin/exams/${examId}`}
              className="inline-block text-sm font-medium text-storm-medium-blue no-underline hover:underline"
            >
              Open full quiz builder →
            </Link>
          </div>
        ) : (
          <p className="mt-1 text-sm text-amber-900">
            Not linked to any quiz. Learners won&apos;t have questions until you link or create
            one.
          </p>
        )}
      </div>

      <label className="block text-sm">
        Title
        <input name="title" defaultValue={item.title} required className={inputClass} />
      </label>
      <p className="text-xs text-storm-navy/60">
        Saved to both the curriculum item and the linked quiz/exam (keeps titles in sync).
      </p>
      {examId && (
        <div className="space-y-3 rounded-lg border border-storm-light-blue/40 bg-storm-light-grey/30 p-3">
          <p className="text-sm font-medium text-storm-navy">Exam settings</p>
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
          <div>
            <button
              type="button"
              onClick={() => setShowLink((v) => !v)}
              className="text-sm font-medium text-storm-medium-blue hover:underline"
            >
              {showLink ? "Hide link picker" : "Link a different existing quiz/exam…"}
            </button>
            {showLink ? (
              <div className="mt-2 space-y-2">
                <select
                  className={inputClass}
                  value={linkExamId}
                  onChange={(e) => setLinkExamId(e.target.value)}
                >
                  <option value="">Choose…</option>
                  {linkables.map((exam) => (
                    <option key={exam.id} value={exam.id}>
                      {exam.title} · {exam._count.questions} questions
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!linkExamId || linking}
                  onClick={() => void handleLinkExisting()}
                  className="min-h-9 rounded-lg bg-storm-navy px-3 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {linking ? "Linking…" : "Use selected quiz"}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      )}
      {!examId ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <button
            type="button"
            className="font-semibold underline"
            onClick={() => setShowLink(true)}
          >
            Link an existing quiz/exam
          </button>
          {showLink ? (
            <div className="mt-2 space-y-2">
              <select
                className={inputClass}
                value={linkExamId}
                onChange={(e) => setLinkExamId(e.target.value)}
              >
                <option value="">Choose…</option>
                {linkables.map((exam) => (
                  <option key={exam.id} value={exam.id}>
                    {exam.title} · {exam._count.questions} questions
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!linkExamId || linking}
                onClick={() => void handleLinkExisting()}
                className="min-h-9 rounded-lg bg-storm-navy px-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                {linking ? "Linking…" : "Link selected"}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
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
