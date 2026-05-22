import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth-utils";
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
  await requireAdmin();
  const { courseId } = await params;
  const course = await getCourseForBuilder(courseId);
  if (!course) notFound();
  const users = await listUsersForAssignment();

  return (
    <Suspense fallback={<p className="text-sm text-storm-navy/60">Loading builder…</p>}>
      <CourseBuilderShell course={course} users={users} />
    </Suspense>
  );
}
