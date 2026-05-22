import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth-utils";
import { getExamForTake } from "@/lib/repositories/exams";
import { startExamAttempt } from "@/lib/actions/exams";
import { ExamTakeForm } from "./ExamTakeForm";
import { userCanTakeExam } from "@/lib/exams/access";
import {
  effectiveAttemptsAllowed,
  getInProgressAttempt,
  getRemainingAttempts,
  resolveQuestionOrder,
} from "@/lib/exams/attempt-state";
import { prisma } from "@/lib/db";

export default async function ExamTakePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireUser();

  const access = await userCanTakeExam(session.user.id, id);
  if (!access.allowed) redirect("/exams");

  const exam = await getExamForTake(id, session.user.id);
  if (!exam) notFound();

  const attemptsAllowed = effectiveAttemptsAllowed(exam.attemptsAllowed);

  const passed = await prisma.examAttempt.findFirst({
    where: { userId: session.user.id, examId: id, passed: true },
  });
  if (passed) redirect(`/exams/${id}/results`);

  let attempt = await getInProgressAttempt(session.user.id, id);

  if (!attempt) {
    const remaining = await getRemainingAttempts(
      session.user.id,
      id,
      attemptsAllowed,
    );

    if (remaining <= 0) {
      return (
        <TakeBlocked
          examTitle={exam.title}
          message={`You have used all ${attemptsAllowed} allowed attempt${attemptsAllowed === 1 ? "" : "s"}.`}
        />
      );
    }

    const started = await startExamAttempt(id);
    if (started.error || !started.attemptId) {
      return (
        <TakeBlocked
          examTitle={exam.title}
          message={started.error ?? "Unable to start this exam. Please try again or contact your administrator."}
        />
      );
    }

    attempt = await prisma.examAttempt.findUnique({
      where: { id: started.attemptId },
    });
  }

  if (!attempt) notFound();

  const ordered = resolveQuestionOrder(attempt.questionOrder, exam.questions);

  if (ordered.length === 0) {
    return (
      <>
        <TakeBackLink />
        <h1 className="font-title mt-4 text-2xl font-bold text-storm-navy">
          {exam.title}
        </h1>
        <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-6">
          <p className="font-medium text-storm-navy">This exam has no questions yet</p>
          <p className="mt-2 text-sm text-storm-navy/70">
            An administrator must add questions before you can take this exam.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <TakeBackLink />
      <h1 className="font-title mt-4 text-2xl font-bold text-storm-navy">
        {exam.title}
      </h1>
      <p className="mt-2 text-sm text-storm-navy/60">
        {exam.timeLimitMinutes} minutes · {exam.passingScore}% required to pass ·{" "}
        {attemptsAllowed} attempt{attemptsAllowed === 1 ? "" : "s"} allowed
      </p>
      <ExamTakeForm
        attemptId={attempt.id}
        examId={id}
        questions={ordered.map((q) => ({
          id: q.id,
          type: q.type,
          text: q.text,
          config: q.config,
          options: q.options.map((o) => ({ id: o.id, text: o.text })),
        }))}
        timeLimitMinutes={exam.timeLimitMinutes}
      />
    </>
  );
}

function TakeBackLink() {
  return (
    <Link href="/exams" className="text-sm text-storm-medium-blue no-underline hover:underline">
      ← Back to exams
    </Link>
  );
}

function TakeBlocked({ examTitle, message }: { examTitle: string; message: string }) {
  return (
    <>
      <TakeBackLink />
      <h1 className="font-title mt-4 text-2xl font-bold text-storm-navy">{examTitle}</h1>
      <div className="mt-6 rounded-xl border border-storm-pink/30 bg-storm-pink/10 p-6">
        <p className="font-medium text-storm-navy">{message}</p>
        <Link
          href="/exams"
          className="mt-4 inline-flex min-h-11 items-center text-sm font-medium text-storm-medium-blue no-underline"
        >
          Back to exams
        </Link>
      </div>
    </>
  );
}
