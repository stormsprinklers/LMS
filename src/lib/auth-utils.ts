import { auth } from "@/auth";
import {
  canManageCourse,
  canManageExam,
  canAccessAdminPanel,
  isAdmin,
  isStaff,
} from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session;
}

export type StaffSession = Awaited<ReturnType<typeof requireUser>>;

export async function requireAdmin() {
  const session = await requireUser();
  const role = (session.user as { role?: string }).role;
  if (!isAdmin(role)) redirect("/");
  return session;
}

/** Admins and managers (content creators). */
export async function requireStaff() {
  const session = await requireUser();
  const role = (session.user as { role?: string }).role;
  if (!isStaff(role)) redirect("/");
  return session;
}

export async function requireAdminOrCourseAdmin() {
  const session = await requireUser();
  const role = (session.user as { role?: string }).role;
  if (!canAccessAdminPanel(role)) redirect("/");
  return session;
}

export async function requireManageCourse(courseId: string) {
  const session = await requireUser();
  const role = (session.user as { role?: string }).role;
  const userId = session.user.id;
  if (!(await canManageCourse(userId, role, courseId))) redirect("/");
  return session;
}

export async function requireManageExam(examId: string) {
  const session = await requireUser();
  const role = (session.user as { role?: string }).role;
  const userId = session.user.id;
  if (!(await canManageExam(userId, role, examId))) redirect("/");
  return session;
}

export async function requireManageModule(moduleId: string) {
  const mod = await prisma.module.findUnique({
    where: { id: moduleId },
    select: { courseId: true },
  });
  if (!mod) redirect("/");
  return requireManageCourse(mod.courseId);
}

export async function requireManageCourseItem(itemId: string) {
  const item = await prisma.courseItem.findUnique({
    where: { id: itemId },
    select: { courseId: true },
  });
  if (!item) redirect("/");
  return requireManageCourse(item.courseId);
}

export async function requireCourseAdmin(courseId: string) {
  const session = await requireUser();
  const role = (session.user as { role?: string }).role;
  if (isAdmin(role)) return session;

  const assignment = await prisma.courseAdmin.findUnique({
    where: { userId_courseId: { userId: session.user.id, courseId } },
  });
  if (!assignment) redirect("/");
  return session;
}

/**
 * View org-wide learner progress for a course.
 * Admins and managers: any course. Course graders: only assigned courses.
 */
export async function requireViewCourseProgress(courseId: string) {
  const session = await requireUser();
  const role = (session.user as { role?: string }).role;
  if (isStaff(role)) return session;

  const assignment = await prisma.courseAdmin.findUnique({
    where: { userId_courseId: { userId: session.user.id, courseId } },
  });
  if (!assignment) redirect("/");
  return session;
}

export async function canGradeExam(userId: string, examId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return false;
  if (isAdmin(user.role)) return true;

  if (user.role === "MANAGER") {
    return canManageExam(userId, user.role, examId);
  }

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
