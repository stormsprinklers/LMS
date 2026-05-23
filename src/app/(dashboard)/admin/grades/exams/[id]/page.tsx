import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { ExamGradesTable } from "@/components/admin/grades/ExamGradesTable";
import { canGradeExam, requireUser } from "@/lib/auth-utils";
import { getExamGradesReport } from "@/lib/repositories/admin-grades";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const report = await getExamGradesReport(id);
  return { title: report ? `Grades — ${report.exam.title}` : "Exam grades" };
}

export default async function ExamGradesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireUser();
  const role = (session.user as { role?: string }).role;
  if (role !== "ADMIN" && !(await canGradeExam(session.user.id, id))) {
    redirect("/");
  }

  const report = await getExamGradesReport(id);
  if (!report) notFound();

  const { exam, learners } = report;

  return (
    <>
      <PageHeader
        title={`Grades: ${exam.title}`}
        description={`${learners.length} learner${learners.length === 1 ? "" : "s"} with submissions · ${exam.passingScore}% to pass`}
        action={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Link
              href="/admin/grades"
              className="text-sm text-storm-medium-blue no-underline hover:underline"
            >
              ← All grades
            </Link>
            {role === "ADMIN" && (
              <Link
                href={`/admin/exams/${exam.id}`}
                className="text-sm text-storm-navy/70 no-underline hover:underline"
              >
                Edit exam
              </Link>
            )}
          </div>
        }
      />
      {exam.course && (
        <p className="mb-4 text-sm text-storm-navy/70">
          Course:{" "}
          <Link
            href={`/admin/grades/courses/${exam.course.id}`}
            className="font-medium text-storm-medium-blue no-underline hover:underline"
          >
            {exam.course.title}
          </Link>
        </p>
      )}
      <ExamGradesTable learners={learners} passingScore={exam.passingScore} />
    </>
  );
}
