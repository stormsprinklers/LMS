import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { CourseGradesTable } from "@/components/admin/grades/CourseGradesTable";
import { requireCourseAdmin } from "@/lib/auth-utils";
import { getCourseGradesReport } from "@/lib/repositories/admin-grades";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const report = await getCourseGradesReport(courseId);
  return {
    title: report ? `Progress — ${report.course.title}` : "Course progress",
  };
}

export default async function CourseGradesPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const session = await requireCourseAdmin(courseId);
  const role = (session.user as { role?: string }).role;

  const report = await getCourseGradesReport(courseId);
  if (!report) notFound();

  const { course, learners, courseExams } = report;

  return (
    <>
      <PageHeader
        title={`Progress: ${course.title}`}
        description={`${learners.length} learner${learners.length === 1 ? "" : "s"} with progress or exam activity`}
        action={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {role === "ADMIN" && (
              <Link
                href="/admin/grades"
                className="text-sm text-storm-medium-blue no-underline hover:underline"
              >
                ← All grades
              </Link>
            )}
            {role === "ADMIN" && (
              <Link
                href={`/admin/courses/${course.id}/builder`}
                className="text-sm text-storm-navy/70 no-underline hover:underline"
              >
                Course builder
              </Link>
            )}
          </div>
        }
      />
      {courseExams.length > 0 && (
        <p className="mb-4 text-sm text-storm-navy/70">
          Exams in this course:{" "}
          {courseExams.map((e, i) => (
            <span key={e.id}>
              {i > 0 && ", "}
              <Link
                href={`/admin/grades/exams/${e.id}`}
                className="font-medium text-storm-medium-blue no-underline hover:underline"
              >
                {e.title}
              </Link>
            </span>
          ))}
        </p>
      )}
      <CourseGradesTable
        learners={learners}
        showExamColumns={courseExams.length > 0}
      />
    </>
  );
}
