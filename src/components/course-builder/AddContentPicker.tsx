"use client";

import { useEffect, useState } from "react";
import type { CourseItemTrack, CourseItemType } from "@prisma/client";
import { ItemTypeIcon } from "./ItemTypeIcon";
import { listLinkableExams } from "@/lib/actions/course-builder";

const OPTIONS: { type: CourseItemType; label: string; track: CourseItemTrack }[] = [
  { type: "LESSON", label: "Lesson", track: "LEARN" },
  { type: "VIDEO", label: "Video", track: "LEARN" },
  { type: "QUIZ", label: "Quiz", track: "PROVE" },
  { type: "EXAM", label: "Exam", track: "PROVE" },
  { type: "SKILL_CHECK", label: "Skill Check", track: "PROVE" },
  { type: "SCENARIO", label: "Scenario", track: "PRACTICE" },
];

type LinkableExam = {
  id: string;
  title: string;
  published: boolean;
  _count: { questions: number };
  course: { id: string; title: string } | null;
};

export function AddContentPicker({
  open,
  courseId,
  onClose,
  onPick,
  onLinkExam,
}: {
  open: boolean;
  courseId: string;
  onClose: () => void;
  onPick: (type: CourseItemType, track: CourseItemTrack) => void;
  onLinkExam: (type: "QUIZ" | "EXAM", track: CourseItemTrack, examId: string) => void;
}) {
  const [step, setStep] = useState<"pick" | "quiz-mode" | "link">("pick");
  const [pending, setPending] = useState<{
    type: "QUIZ" | "EXAM";
    track: CourseItemTrack;
  } | null>(null);
  const [exams, setExams] = useState<LinkableExam[]>([]);
  const [loadingExams, setLoadingExams] = useState(false);
  const [selectedExamId, setSelectedExamId] = useState("");

  useEffect(() => {
    if (!open) {
      setStep("pick");
      setPending(null);
      setSelectedExamId("");
      setExams([]);
    }
  }, [open]);

  useEffect(() => {
    if (step !== "link" || !open) return;
    let cancelled = false;
    setLoadingExams(true);
    void listLinkableExams(courseId)
      .then((rows) => {
        if (!cancelled) setExams(rows);
      })
      .finally(() => {
        if (!cancelled) setLoadingExams(false);
      });
    return () => {
      cancelled = true;
    };
  }, [step, open, courseId]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
        {step === "pick" ? (
          <>
            <h3 className="font-title text-lg font-bold text-storm-navy">What do you want to add?</h3>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {OPTIONS.map((o) => (
                <button
                  key={o.type}
                  type="button"
                  onClick={() => {
                    if (o.type === "QUIZ" || o.type === "EXAM") {
                      setPending({ type: o.type, track: o.track });
                      setStep("quiz-mode");
                      return;
                    }
                    onPick(o.type, o.track);
                    onClose();
                  }}
                  className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-lg border border-storm-light-blue/60 p-3 text-sm font-medium text-storm-navy hover:bg-storm-light-grey/50"
                >
                  <ItemTypeIcon type={o.type} className="h-6 w-6" />
                  {o.label}
                </button>
              ))}
            </div>
          </>
        ) : null}

        {step === "quiz-mode" && pending ? (
          <>
            <h3 className="font-title text-lg font-bold text-storm-navy">
              Add {pending.type === "QUIZ" ? "quiz" : "exam"}
            </h3>
            <p className="mt-1 text-sm text-storm-navy/70">
              Create a blank one, or link an existing quiz/exam you already built.
            </p>
            <div className="mt-4 grid gap-2">
              <button
                type="button"
                onClick={() => {
                  onPick(pending.type, pending.track);
                  onClose();
                }}
                className="min-h-12 rounded-lg border border-storm-light-blue/60 px-4 py-3 text-left text-sm font-medium text-storm-navy hover:bg-storm-light-grey/50"
              >
                Create new {pending.type === "QUIZ" ? "quiz" : "exam"}
              </button>
              <button
                type="button"
                onClick={() => setStep("link")}
                className="min-h-12 rounded-lg border border-storm-light-blue/60 px-4 py-3 text-left text-sm font-medium text-storm-navy hover:bg-storm-light-grey/50"
              >
                Link existing quiz/exam…
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                setStep("pick");
                setPending(null);
              }}
              className="mt-3 text-sm text-storm-navy/70 hover:underline"
            >
              ← Back
            </button>
          </>
        ) : null}

        {step === "link" && pending ? (
          <>
            <h3 className="font-title text-lg font-bold text-storm-navy">Link existing quiz/exam</h3>
            <p className="mt-1 text-sm text-storm-navy/70">
              Only quizzes not already attached to a curriculum item are listed.
            </p>
            {loadingExams ? (
              <p className="mt-4 text-sm text-storm-navy/60">Loading…</p>
            ) : !exams.length ? (
              <p className="mt-4 text-sm text-storm-navy/60">No unlinked quizzes/exams found.</p>
            ) : (
              <label className="mt-4 block text-sm">
                Select quiz/exam
                <select
                  className="mt-1 w-full min-h-10 rounded-lg border border-storm-light-blue/60 px-3 py-2 text-sm"
                  value={selectedExamId}
                  onChange={(e) => setSelectedExamId(e.target.value)}
                >
                  <option value="">Choose…</option>
                  {exams.map((exam) => (
                    <option key={exam.id} value={exam.id}>
                      {exam.title}
                      {exam.course ? ` (${exam.course.title})` : ""}
                      {` · ${exam._count.questions} q`}
                      {!exam.published ? " · draft" : ""}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!selectedExamId}
                onClick={() => {
                  if (!selectedExamId) return;
                  onLinkExam(pending.type, pending.track, selectedExamId);
                  onClose();
                }}
                className="min-h-10 rounded-lg bg-storm-medium-blue px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                Link to course
              </button>
              <button
                type="button"
                onClick={() => setStep("quiz-mode")}
                className="min-h-10 rounded-lg border px-4 text-sm text-storm-navy/70"
              >
                Back
              </button>
            </div>
          </>
        ) : null}

        {step === "pick" ? (
          <button
            type="button"
            onClick={onClose}
            className="mt-4 w-full min-h-10 rounded-lg border text-sm text-storm-navy/70"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </div>
  );
}
