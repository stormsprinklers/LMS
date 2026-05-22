import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth-utils";
import { getExamForTake, countAttempts } from "@/lib/repositories/exams";
import { startExamAttempt } from "@/lib/actions/exams";
import { ExamTakeForm } from "./ExamTakeForm";

export default async function ExamTakePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireUser();
  const data = await getExamForTake(id, session.user.id);

  if (!data) notFound();
  if (data.status === "locked") redirect("/exams");
  if (data.status === "passed") redirect(`/exams/${id}/results`);

  const attempts = await countAttempts(session.user.id, id);
  if (attempts >= data.exam.attemptsAllowed) {
    redirect(`/exams/${id}/results`);
  }

  const attemptId = await startExamAttempt(id);

  return (
    <>
      <Link href="/exams" className="text-sm text-storm-medium-blue no-underline hover:underline">
        ← Back to exams
      </Link>
      <h1 className="font-title mt-4 text-2xl font-bold text-storm-navy">
        {data.exam.title}
      </h1>
      <p className="mt-2 text-sm text-storm-navy/60">
        {data.exam.timeLimitMinutes} minutes · {data.exam.passingScore}% required to pass
      </p>
      <ExamTakeForm
        attemptId={attemptId}
        examId={id}
        questions={data.exam.questions.map((q) => ({
          id: q.id,
          text: q.text,
          options: q.options.map((o) => ({ id: o.id, text: o.text })),
        }))}
        timeLimitMinutes={data.exam.timeLimitMinutes}
      />
    </>
  );
}
