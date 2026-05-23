"use server";

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-utils";
import { revalidatePath } from "next/cache";

function revalidateAdmin() {
  revalidatePath("/admin");
  revalidatePath("/admin/courses");
  revalidatePath("/admin/exams");
  revalidatePath("/admin/users");
  revalidatePath("/admin/certifications");
  revalidatePath("/admin/media");
  revalidatePath("/admin/grading");
  revalidatePath("/admin/archived");
  revalidatePath("/courses");
  revalidatePath("/exams");
  revalidatePath("/manuals");
}

export async function archiveCourse(courseId: string) {
  await requireAdmin();
  await prisma.course.update({
    where: { id: courseId },
    data: { archived: true, archivedAt: new Date(), published: false },
  });
  revalidateAdmin();
}

export async function restoreCourse(courseId: string) {
  await requireAdmin();
  await prisma.course.update({
    where: { id: courseId },
    data: { archived: false, archivedAt: null },
  });
  revalidateAdmin();
}

export async function deleteCourse(courseId: string) {
  await requireAdmin();
  await prisma.course.delete({ where: { id: courseId } });
  revalidateAdmin();
  return { success: true as const };
}

export async function archiveUser(userId: string) {
  await requireAdmin();
  await prisma.user.update({
    where: { id: userId },
    data: { archived: true, archivedAt: new Date(), status: "DISABLED" },
  });
  revalidateAdmin();
}

export async function restoreUser(userId: string) {
  await requireAdmin();
  await prisma.user.update({
    where: { id: userId },
    data: { archived: false, archivedAt: null, status: "ACTIVE" },
  });
  revalidateAdmin();
}

export async function deleteUser(userId: string) {
  const session = await requireAdmin();

  if (userId === session.user.id) {
    return { error: "You cannot delete your own account." };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, email: true },
  });
  if (!user) return { error: "User not found." };

  if (user.role === "ADMIN") {
    const adminCount = await prisma.user.count({
      where: { role: "ADMIN", archived: false },
    });
    if (adminCount <= 1) {
      return { error: "Cannot delete the last active admin." };
    }
  }

  try {
    await prisma.user.delete({ where: { id: userId } });
  } catch {
    return {
      error: "Could not delete this user. Try archiving them instead.",
    };
  }

  revalidateAdmin();
  return { success: true as const };
}

export async function archiveCertificationRule(ruleId: string) {
  await requireAdmin();
  await prisma.certificationRule.update({
    where: { id: ruleId },
    data: { archived: true, archivedAt: new Date() },
  });
  revalidateAdmin();
}

export async function restoreCertificationRule(ruleId: string) {
  await requireAdmin();
  await prisma.certificationRule.update({
    where: { id: ruleId },
    data: { archived: false, archivedAt: null },
  });
  revalidateAdmin();
}

export async function deleteCertificationRule(ruleId: string) {
  await requireAdmin();
  await prisma.certificationRule.delete({ where: { id: ruleId } });
  revalidateAdmin();
  return { success: true as const };
}

export async function archiveManual(manualId: string) {
  await requireAdmin();
  await prisma.manualAsset.update({
    where: { id: manualId },
    data: { archived: true, archivedAt: new Date() },
  });
  revalidateAdmin();
}

export async function restoreManual(manualId: string) {
  await requireAdmin();
  await prisma.manualAsset.update({
    where: { id: manualId },
    data: { archived: false, archivedAt: null },
  });
  revalidateAdmin();
}

export async function deleteManual(manualId: string) {
  await requireAdmin();
  await prisma.manualAsset.delete({ where: { id: manualId } });
  revalidateAdmin();
  return { success: true as const };
}

export async function archiveLesson(lessonId: string) {
  await requireAdmin();
  await prisma.lesson.update({
    where: { id: lessonId },
    data: { archived: true, archivedAt: new Date() },
  });
  revalidateAdmin();
}

export async function restoreLesson(lessonId: string) {
  await requireAdmin();
  await prisma.lesson.update({
    where: { id: lessonId },
    data: { archived: false, archivedAt: null },
  });
  revalidateAdmin();
}

export async function deleteLesson(lessonId: string) {
  await requireAdmin();
  await prisma.lesson.delete({ where: { id: lessonId } });
  revalidateAdmin();
  return { success: true as const };
}

/** Archive all pending grading tasks for an attempt (removes from inbox). */
export async function archiveGradingAttempt(attemptId: string) {
  await requireAdmin();
  await prisma.gradingTask.updateMany({
    where: { attemptId, status: "PENDING" },
    data: { archived: true, archivedAt: new Date() },
  });
  revalidateAdmin();
}

export async function restoreGradingAttempt(attemptId: string) {
  await requireAdmin();
  await prisma.gradingTask.updateMany({
    where: { attemptId },
    data: { archived: false, archivedAt: null },
  });
  revalidateAdmin();
}

export async function deleteGradingAttempt(attemptId: string) {
  await requireAdmin();
  await prisma.examAttempt.delete({ where: { id: attemptId } });
  revalidateAdmin();
  return { success: true as const };
}

export async function listArchivedAdmin() {
  await requireAdmin();
  const [courses, exams, users, certRules, manuals, lessons, gradingTasks] =
    await Promise.all([
      prisma.course.findMany({
        where: { archived: true },
        orderBy: { archivedAt: "desc" },
        select: { id: true, title: true, slug: true, archivedAt: true },
      }),
      prisma.exam.findMany({
        where: { archived: true },
        orderBy: { archivedAt: "desc" },
        select: { id: true, title: true, archivedAt: true },
      }),
      prisma.user.findMany({
        where: { archived: true },
        orderBy: { archivedAt: "desc" },
        select: { id: true, name: true, email: true, archivedAt: true },
      }),
      prisma.certificationRule.findMany({
        where: { archived: true },
        orderBy: { archivedAt: "desc" },
        select: { id: true, title: true, archivedAt: true, course: { select: { title: true } } },
      }),
      prisma.manualAsset.findMany({
        where: { archived: true },
        orderBy: { archivedAt: "desc" },
        select: { id: true, title: true, archivedAt: true },
      }),
      prisma.lesson.findMany({
        where: { archived: true, type: "VIDEO" },
        orderBy: { archivedAt: "desc" },
        select: {
          id: true,
          title: true,
          archivedAt: true,
          module: { include: { course: { select: { title: true } } } },
        },
      }),
      prisma.gradingTask.findMany({
        where: { archived: true },
        include: {
          attempt: {
            include: {
              exam: { select: { title: true } },
              user: { select: { name: true, email: true } },
            },
          },
        },
        orderBy: { archivedAt: "desc" },
      }),
    ]);

  const gradingByAttempt = new Map<
    string,
    {
      attemptId: string;
      archivedAt: Date | null;
      attempt: (typeof gradingTasks)[0]["attempt"];
    }
  >();
  for (const t of gradingTasks) {
    if (!gradingByAttempt.has(t.attemptId)) {
      gradingByAttempt.set(t.attemptId, {
        attemptId: t.attemptId,
        archivedAt: t.archivedAt,
        attempt: t.attempt,
      });
    }
  }

  return {
    courses,
    exams,
    users,
    certRules,
    manuals,
    lessons,
    grading: [...gradingByAttempt.values()],
  };
}
