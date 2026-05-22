import Link from "next/link";
import { ClipboardCheck, Clock, Target } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireUser } from "@/lib/auth-utils";
import { getExamsForUser } from "@/lib/repositories/exams";
import type { Exam } from "@/lib/types";

const statusConfig: Record<
  Exam["status"],
  { label: string; variant: "success" | "warning" | "default" | "pink" }
> = {
  available: { label: "Ready to take", variant: "warning" },
  passed: { label: "Passed", variant: "success" },
  failed: { label: "Retake required", variant: "pink" },
  locked: { label: "Complete prerequisites", variant: "default" },
};

export const metadata = { title: "Exams" };

export default async function ExamsPage() {
  const session = await requireUser();
  const exams = await getExamsForUser(session.user.id);

  return (
    <>
      <PageHeader
        title="Exams"
        description="Knowledge checks and assessments required to complete courses and earn certifications."
      />

      <div className="space-y-4">
        {exams.map((exam) => {
          const { label, variant } = statusConfig[exam.status];
          const canTake = exam.status === "available" || exam.status === "failed";

          return (
            <Card key={exam.id}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-storm-pink/15 text-storm-pink">
                    <ClipboardCheck className="h-6 w-6" />
                  </div>
                  <div>
                    <Badge variant="info">{exam.courseTitle}</Badge>
                    <h3 className="font-title mt-1 text-lg font-bold text-storm-navy">
                      {exam.title}
                    </h3>
                    <div className="mt-2 flex flex-wrap gap-4 text-sm text-storm-navy/60">
                      <span className="flex items-center gap-1">
                        <Target className="h-4 w-4" />
                        {exam.questionCount} questions · {exam.passingScore}% to pass
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {exam.timeLimitMinutes} min · {exam.attemptsAllowed} attempts
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={variant}>{label}</Badge>
                  {canTake ? (
                    <Link
                      href={`/exams/${exam.id}/take`}
                      className="rounded-lg bg-storm-medium-blue px-4 py-2 text-sm font-semibold text-white no-underline transition-opacity hover:opacity-90"
                    >
                      Start exam
                    </Link>
                  ) : exam.status === "passed" ? (
                    <Link
                      href={`/exams/${exam.id}/results`}
                      className="rounded-lg border border-storm-medium-blue px-4 py-2 text-sm font-semibold text-storm-medium-blue no-underline"
                    >
                      View results
                    </Link>
                  ) : (
                    <span className="rounded-lg bg-storm-light-grey px-4 py-2 text-sm text-storm-navy/50">
                      Locked
                    </span>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
