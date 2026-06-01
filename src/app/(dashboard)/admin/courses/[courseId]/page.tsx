import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

export default async function AdminCourseSlugRedirect({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId: slug } = await params;
  const course = await prisma.course.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!course) redirect("/admin/courses");
  redirect(`/admin/courses/${course.id}/builder`);
}
