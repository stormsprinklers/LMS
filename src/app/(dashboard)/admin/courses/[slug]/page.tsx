import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { getCourseBySlugAdmin } from "@/lib/repositories/courses";
import { AddLessonForm } from "./AddLessonForm";
import Link from "next/link";
import { AdminEntityActions } from "@/components/admin/AdminEntityActions";

export default async function AdminCourseEditPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const course = await getCourseBySlugAdmin(slug);
  if (!course) notFound();

  const module = course.modules[0];

  return (
    <>
      <PageHeader title={course.title} description="Edit lessons and content." />
      {module && (
        <>
          <AddLessonForm moduleId={module.id} />
          <ul className="mt-6 space-y-2">
            {module.lessons.map((lesson) => (
              <li
                key={lesson.id}
                className="flex flex-col gap-3 rounded-lg border bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-medium text-storm-navy break-words">{lesson.title}</p>
                  <p className="text-xs text-storm-navy/60">{lesson.type}</p>
                </div>
                {lesson.exam && (
                  <Link
                    href={`/admin/exams/${lesson.exam.id}`}
                    className="flex min-h-11 shrink-0 items-center text-sm font-medium text-storm-medium-blue no-underline"
                  >
                    Edit exam
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="mt-10 rounded-xl border border-red-200 bg-red-50/50 p-5">
        <h3 className="font-medium text-storm-navy">Archive or delete course</h3>
        <p className="mt-1 text-sm text-storm-navy/70">
          Archiving hides this course from learners. Deleting removes the course and all lessons
          permanently.
        </p>
        <div className="mt-4">
          <AdminEntityActions
            type="course"
            id={course.id}
            name={course.title}
            archived={course.archived}
          />
        </div>
      </div>
    </>
  );
}
