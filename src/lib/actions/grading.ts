"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { canGradeExam } from "@/lib/auth-utils";
import { computeAttemptScore, finalizeAttemptScore } from "@/lib/exams/grade-attempt";
import { revalidatePath } from "next/cache";

export async function getGradingInbox() {
  const session = await auth();
  if (!session?.user?.id) return [];

  const userId = session.user.id;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return [];

  const courseIds =
    user.role === "ADMIN"
      ? undefined
      : (
          await prisma.courseAdmin.findMany({
            where: { userId },
            select: { courseId: true },
          })
        ).map((c) => c.courseId);

  const tasks = await prisma.gradingTask.findMany({
    where: {
      status: "PENDING",
      archived: false,
      ...(user.role === "ADMIN"
        ? {}
        : {
            OR: [
              { courseId: { in: courseIds } },
              { assignedToUserId: userId },
              {
                attempt: {
                  exam: { graders: { some: { userId } } },
                },
              },
            ],
          }),
    },
    include: {
      attempt: {
        include: {
          user: true,
          exam: { include: { course: true } },
        },
      },
      question: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return tasks;
}

export async function getUnreadNotificationCount() {
  const session = await auth();
  if (!session?.user?.id) return 0;
  return prisma.notification.count({
    where: { userId: session.user.id, readAt: null },
  });
}

export async function getAttemptForGrading(attemptId: string) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const attempt = await prisma.examAttempt.findUnique({
    where: { id: attemptId },
    include: {
      user: true,
      exam: true,
      examAnswers: { include: { question: { include: { options: true } } } },
      gradingTasks: { where: { status: "PENDING" }, include: { question: true } },
    },
  });
  if (!attempt) return null;
  const allowed = await canGradeExam(session.user.id, attempt.examId);
  if (!allowed) return null;
  return attempt;
}

export async function submitManualGrade(
  attemptId: string,
  questionId: string,
  manualScore: number,
  feedback?: string,
) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };

  const attempt = await prisma.examAttempt.findUnique({
    where: { id: attemptId },
    include: { exam: true },
  });
  if (!attempt) return { error: "Attempt not found" };
  if (!(await canGradeExam(session.user.id, attempt.examId))) {
    return { error: "Not allowed to grade" };
  }

  await prisma.examAnswer.update({
    where: { attemptId_questionId: { attemptId, questionId } },
    data: {
      manualScore,
      feedback,
      gradedById: session.user.id,
      gradedAt: new Date(),
    },
  });

  await prisma.gradingTask.updateMany({
    where: { attemptId, questionId },
    data: { status: "COMPLETED", completedAt: new Date() },
  });

  const pending = await prisma.gradingTask.count({
    where: { attemptId, status: "PENDING" },
  });

  if (pending === 0) {
    const answers = await prisma.examAnswer.findMany({
      where: { attemptId },
    });
    const { score, passed } = await finalizeAttemptScore(
      attempt.exam,
      answers,
    );
    await prisma.examAttempt.update({
      where: { id: attemptId },
      data: {
        score,
        passed,
        pendingManualGrade: false,
        status: passed ? "PASSED" : "FAILED",
        completedAt: new Date(),
      },
    });

    if (
      passed &&
      attempt.exam.courseId &&
      attempt.exam.gradeVisibility === "LEARNER_VISIBLE"
    ) {
      const rule = await prisma.certificationRule.findFirst({
        where: { courseId: attempt.exam.courseId },
      });
      if (rule) {
        const expires = new Date();
        expires.setMonth(expires.getMonth() + rule.validityMonths);
        await prisma.certification.upsert({
          where: {
            userId_ruleId: { userId: attempt.userId, ruleId: rule.id },
          },
          update: {
            status: "EARNED",
            issuedAt: new Date(),
            expiresAt: expires,
          },
          create: {
            userId: attempt.userId,
            ruleId: rule.id,
            title: rule.title,
            status: "EARNED",
            issuedAt: new Date(),
            expiresAt: expires,
          },
        });
      }
    }
  }

  revalidatePath("/admin/grading");
  revalidatePath(`/admin/grading/${attemptId}`);
  return { success: true };
}

export async function markNotificationRead(notificationId: string) {
  const session = await auth();
  if (!session?.user?.id) return;
  await prisma.notification.updateMany({
    where: { id: notificationId, userId: session.user.id },
    data: { readAt: new Date() },
  });
}
