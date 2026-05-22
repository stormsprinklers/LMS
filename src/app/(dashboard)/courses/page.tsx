import { CourseCard } from "@/components/courses/CourseCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireUser } from "@/lib/auth-utils";
import { getCoursesForUser } from "@/lib/repositories/courses";

export const metadata = { title: "Courses" };

export default async function CoursesPage() {
  const session = await requireUser();
  const courses = await getCoursesForUser(session.user.id);

  return (
    <>
      <PageHeader
        title="Courses"
        description="Structured learning paths combining videos, manuals, and assessments for your role."
      />

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {courses.map((course) => (
          <CourseCard key={course.id} course={course} />
        ))}
      </div>
    </>
  );
}
