import { notFound } from "next/navigation";
import { requireManageCourse } from "@/lib/auth-utils";
import { canDestructAdminActions } from "@/lib/auth/permissions";
import { getCourseForBuilder } from "@/lib/repositories/course-builder";
import { listUsersForAssignment } from "@/lib/repositories/course-builder";
import { CourseBuilderShell } from "@/components/course-builder/CourseBuilderShell";
import { Suspense } from "react";

export const metadata = { title: "Admin — Course Builder" };

export default async function CourseBuilderPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const session = await requireManageCourse(courseId);
  const role = (session.user as { role?: string }).role;
  const course = await getCourseForBuilder(courseId);
  if (!course) notFound();
  const users = await listUsersForAssignment();

  return (
    <Suspense fallback={<p className="text-sm text-storm-navy/60">Loading builder…</p>}>
      <CourseBuilderShell
        course={course}
        users={users}
        allowDestructive={canDestructAdminActions(role)}
      />
    </Suspense>
  );
}
