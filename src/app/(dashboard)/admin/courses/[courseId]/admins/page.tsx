import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { getCourseBySlugAdmin } from "@/lib/repositories/courses";
import { listUsersForAssignment } from "@/lib/actions/exams-admin";
import { prisma } from "@/lib/db";
import { CourseAdminsForm } from "./CourseAdminsForm";

export default async function CourseAdminsPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId: slug } = await params;
  const course = await getCourseBySlugAdmin(slug);
  if (!course) notFound();

  const [users, admins] = await Promise.all([
    listUsersForAssignment(),
    prisma.courseAdmin.findMany({
      where: { courseId: course.id },
      include: { user: true },
    }),
  ]);

  return (
    <>
      <PageHeader
        title={`Course admins — ${course.title}`}
        description="Users who can grade free-response questions for this course's exams."
        action={
          <Link href={`/admin/courses/${slug}`} className="text-sm text-storm-medium-blue no-underline">
            ← Course
          </Link>
        }
      />
      <CourseAdminsForm
        courseId={course.id}
        users={users}
        adminUserIds={admins.map((a) => a.userId)}
      />
    </>
  );
}
