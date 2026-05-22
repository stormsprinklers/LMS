import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth-utils";
import { getExamForTake, countAttempts } from "@/lib/repositories/exams";
import { startExamAttempt } from "@/lib/actions/exams";
import { prisma } from "@/lib/db";
import { ExamTakeForm } from "./ExamTakeForm";
import { userCanTakeExam } from "@/lib/exams/access";

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

  const passed = await prisma.examAttempt.findFirst({
    where: { userId: session.user.id, examId: id, passed: true },
  });
  if (passed) redirect(`/exams/${id}/results`);

  const attempts = await countAttempts(session.user.id, id);
  if (attempts >= exam.attemptsAllowed) {
    redirect(`/exams/${id}/results`);
  }

  let inProgress = await prisma.examAttempt.findFirst({
    where: { userId: session.user.id, examId: id, status: "IN_PROGRESS" },
  });

  if (!inProgress) {
    const started = await startExamAttempt(id);
    if (started.error || !started.attemptId) redirect("/exams");
    inProgress = await prisma.examAttempt.findUnique({
      where: { id: started.attemptId },
    });
  }

  if (!inProgress) notFound();

  const order = (inProgress.questionOrder as string[]) ?? [];
  const ordered = order.length
    ? order
        .map((qid) => exam.questions.find((q) => q.id === qid))
        .filter(Boolean)
    : exam.questions;

  return (
    <>
      <Link href="/exams" className="text-sm text-storm-medium-blue no-underline hover:underline">
        ← Back to exams
      </Link>
      <h1 className="font-title mt-4 text-2xl font-bold text-storm-navy">
        {exam.title}
      </h1>
      <p className="mt-2 text-sm text-storm-navy/60">
        {exam.timeLimitMinutes} minutes · {exam.passingScore}% required to pass
      </p>
      <ExamTakeForm
        attemptId={inProgress.id}
        examId={id}
        questions={ordered.map((q) => ({
          id: q!.id,
          type: q!.type,
          text: q!.text,
          config: q!.config,
          options: q!.options.map((o) => ({ id: o.id, text: o.text })),
        }))}
        timeLimitMinutes={exam.timeLimitMinutes}
      />
    </>
  );
}
