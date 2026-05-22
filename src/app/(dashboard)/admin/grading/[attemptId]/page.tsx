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
  const data = await getAttemptForGrading(attemptId);
  if (!data) notFound();

  return (
    <>
      <PageHeader
        title={`Grade: ${data.examTitle}`}
        description={data.learnerName}
        action={
          <Link
            href="/admin/grading"
            className="text-sm text-storm-medium-blue no-underline"
          >
            ← Inbox
          </Link>
        }
      />
      <GradeAttemptForm
        attemptId={data.attemptId}
        questions={data.questions}
        pendingManualCount={data.pendingManualCount}
      />
    </>
  );
}
