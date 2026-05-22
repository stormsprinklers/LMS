import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session;
}

export async function requireAdmin() {
  const session = await requireUser();
  const role = (session.user as { role?: string }).role;
  if (role !== "ADMIN") redirect("/");
  return session;
}

export async function requireAdminOrCourseAdmin() {
  const session = await requireUser();
  const role = (session.user as { role?: string }).role;
  if (role !== "ADMIN" && role !== "COURSE_ADMIN") redirect("/");
  return session;
}

export async function requireCourseAdmin(courseId: string) {
  const session = await requireUser();
  const role = (session.user as { role?: string }).role;
  if (role === "ADMIN") return session;

  const assignment = await prisma.courseAdmin.findUnique({
    where: { userId_courseId: { userId: session.user.id, courseId } },
  });
  if (!assignment) redirect("/");
  return session;
}

export async function canGradeExam(userId: string, examId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return false;
  if (user.role === "ADMIN") return true;

  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    select: { courseId: true },
  });
  if (!exam) return false;

  if (exam.courseId) {
    const ca = await prisma.courseAdmin.findUnique({
      where: { userId_courseId: { userId, courseId: exam.courseId } },
    });
    if (ca) return true;
  }

  const grader = await prisma.examGrader.findUnique({
    where: { examId_userId: { examId, userId } },
  });
  return !!grader;
}

export async function getUserId() {
  const session = await auth();
  return session?.user?.id ?? null;
}
