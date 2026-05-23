import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";

export const ASSIGNABLE_ROLES: UserRole[] = [
  "EMPLOYEE",
  "MANAGER",
  "ADMIN",
  "COURSE_ADMIN",
];

export function roleLabel(role: string): string {
  switch (role) {
    case "ADMIN":
      return "Admin";
    case "MANAGER":
      return "Manager";
    case "COURSE_ADMIN":
      return "Course grader";
    case "EMPLOYEE":
    default:
      return "Employee";
  }
}

export function isAdmin(role: string | undefined): boolean {
  return role === "ADMIN";
}

export function isManager(role: string | undefined): boolean {
  return role === "MANAGER";
}

export function isStaff(role: string | undefined): boolean {
  return isAdmin(role) || isManager(role);
}

export function canAccessAdminPanel(role: string | undefined): boolean {
  return isStaff(role) || role === "COURSE_ADMIN";
}

export function canDestructAdminActions(role: string | undefined): boolean {
  return isAdmin(role);
}

export function managerOwnsContentFilter(
  userId: string,
  role: string | undefined,
): { createdById: string } | Record<string, never> {
  if (isManager(role)) return { createdById: userId };
  return {};
}

export async function canManageCourse(
  userId: string,
  role: string | undefined,
  courseId: string,
): Promise<boolean> {
  if (isAdmin(role)) return true;
  if (!isManager(role)) return false;
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { createdById: true },
  });
  return course?.createdById === userId;
}

export async function canManageExam(
  userId: string,
  role: string | undefined,
  examId: string,
): Promise<boolean> {
  if (isAdmin(role)) return true;
  if (!isManager(role)) return false;
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    select: { createdById: true },
  });
  return exam?.createdById === userId;
}

export async function canManageCourseItem(
  userId: string,
  role: string | undefined,
  itemId: string,
): Promise<boolean> {
  const item = await prisma.courseItem.findUnique({
    where: { id: itemId },
    select: { courseId: true },
  });
  if (!item) return false;
  return canManageCourse(userId, role, item.courseId);
}

export async function canManageModule(
  userId: string,
  role: string | undefined,
  moduleId: string,
): Promise<boolean> {
  const mod = await prisma.module.findUnique({
    where: { id: moduleId },
    select: { courseId: true },
  });
  if (!mod) return false;
  return canManageCourse(userId, role, mod.courseId);
}
