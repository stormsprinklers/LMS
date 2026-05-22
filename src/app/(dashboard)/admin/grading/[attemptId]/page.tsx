import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { getAttemptForGrading } from "@/lib/actions/grading";
import { GradeAttemptForm } from "./GradeAttemptForm";

export default async function GradeAttemptPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = await params;
  const attempt = await getAttemptForGrading(attemptId);
  if (!attempt) notFound();

  const pendingTasks = attempt.gradingTasks;

  return (
    <>
      <PageHeader
        title={`Grade: ${attempt.exam.title}`}
        description={`${attempt.user.name ?? attempt.user.email}`}
        action={
          <Link href="/admin/grading" className="text-sm text-storm-medium-blue no-underline">
            ← Inbox
          </Link>
        }
      />
      <GradeAttemptForm
        attemptId={attemptId}
        tasks={pendingTasks.map((t) => {
          const answer = attempt.examAnswers.find((a) => a.questionId === t.questionId);
          const value = answer?.value as { text?: string } | null;
          const cfg = t.question.config as { rubric?: string } | null;
          return {
            questionId: t.questionId,
            questionText: t.question.text,
            learnerAnswer: value?.text ?? JSON.stringify(answer?.value ?? ""),
            rubric: cfg?.rubric,
          };
        })}
      />
    </>
  );
}
