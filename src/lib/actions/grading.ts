"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { canGradeExam } from "@/lib/auth-utils";
import { resolveQuestionOrder } from "@/lib/exams/attempt-state";
import { formatLearnerAnswerForGrading } from "@/lib/exams/format-answer";
import { finalizeAttemptScore } from "@/lib/exams/grade-attempt";
import { holdsGradesUntilAdminPublish } from "@/lib/exams/grade-visibility";
import type { FreeResponseConfig } from "@/lib/exams/types";
import type { QuestionType } from "@prisma/client";
import { revalidatePath } from "next/cache";

export type GradingQuestionRow = {
  questionId: string;
  index: number;
  type: QuestionType;
  questionText: string;
  learnerAnswer: string;
  rubric?: string;
  autoScore: number | null;
  initialScore: number;
  needsManual: boolean;
};

export async function getGradingInbox() {
  const session = await auth();
  if (!session?.user?.id) return [];

  const userId = session.user.id;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return [];

  const courseIds =
    user.role === "ADMIN" || user.role === "MANAGER"
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
        : user.role === "MANAGER"
          ? {
              attempt: {
                exam: { createdById: userId },
              },
            }
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

export async function getAttemptForGrading(attemptId: string) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const attempt = await prisma.examAttempt.findUnique({
    where: { id: attemptId },
    include: {
      user: true,
      exam: {
        include: {
          questions: {
            orderBy: { sortOrder: "asc" },
            include: { options: { orderBy: { sortOrder: "asc" } } },
          },
        },
      },
      examAnswers: {
        include: {
          question: { include: { options: { orderBy: { sortOrder: "asc" } } } },
        },
      },
    },
  });
  if (!attempt) return null;
  if (!(await canGradeExam(session.user.id, attempt.examId))) return null;
  if (
    !attempt.pendingManualGrade &&
    attempt.status !== "SUBMITTED_PENDING_GRADE"
  ) {
    return null;
  }

  const ordered = resolveQuestionOrder(
    attempt.questionOrder,
    attempt.exam.questions,
  );
  const answersByQuestion = new Map(
    attempt.examAnswers.map((a) => [a.questionId, a]),
  );

  const questions: GradingQuestionRow[] = ordered.map((q, index) => {
    const answer = answersByQuestion.get(q.id);
    const needsManual = q.type === "FREE_RESPONSE";
    const autoScore = answer?.autoScore ?? null;
    const initialScore = answer?.manualScore ?? autoScore ?? 0;
    const cfg = q.config as FreeResponseConfig | null;

    return {
      questionId: q.id,
      index,
      type: q.type,
      questionText: q.text,
      learnerAnswer: formatLearnerAnswerForGrading(
        answer?.question ?? q,
        answer?.value,
      ),
      rubric: cfg?.rubric,
      autoScore,
      initialScore,
      needsManual,
    };
  });

  const pendingManualCount = questions.filter((q) => q.needsManual).length;

  return {
    attemptId: attempt.id,
    examTitle: attempt.exam.title,
    learnerName: attempt.user.name ?? attempt.user.email,
    questions,
    pendingManualCount,
  };
}

export async function saveAttemptGrades(
  attemptId: string,
  grades: { questionId: string; score: number; feedback?: string }[],
) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };

  const attempt = await prisma.examAttempt.findUnique({
    where: { id: attemptId },
    include: { exam: true, examAnswers: true },
  });
  if (!attempt) return { error: "Attempt not found" };
  if (!(await canGradeExam(session.user.id, attempt.examId))) {
    return { error: "Not allowed to grade" };
  }
  if (!attempt.pendingManualGrade) {
    return { error: "This attempt is not awaiting grading." };
  }

  const answerIds = new Set(attempt.examAnswers.map((a) => a.questionId));
  if (grades.length !== answerIds.size) {
    return { error: "Grade every question before saving." };
  }

  for (const g of grades) {
    if (!answerIds.has(g.questionId)) {
      return { error: "Invalid question in grade submission." };
    }
    if (!Number.isFinite(g.score) || g.score < 0 || g.score > 100) {
      return { error: "Each question needs a score from 0 to 100." };
    }
  }

  const now = new Date();
  const graderId = session.user.id;

  await prisma.$transaction(async (tx) => {
    for (const g of grades) {
      await tx.examAnswer.update({
        where: {
          attemptId_questionId: { attemptId, questionId: g.questionId },
        },
        data: {
          manualScore: Math.round(g.score),
          feedback: g.feedback?.trim() || null,
          gradedById: graderId,
          gradedAt: now,
        },
      });
    }

    await tx.gradingTask.updateMany({
      where: { attemptId },
      data: { status: "COMPLETED", completedAt: now },
    });

    await tx.notification.updateMany({
      where: {
        userId: graderId,
        type: "FREE_RESPONSE_TO_GRADE",
        readAt: null,
        OR: [
          { link: `/admin/grading/${attemptId}` },
          { metadata: { path: ["attemptId"], equals: attemptId } },
        ],
      },
      data: { readAt: now },
    });

    const answers = await tx.examAnswer.findMany({ where: { attemptId } });
    const { score, passed } = await finalizeAttemptScore(attempt.exam, answers);

    await tx.examAttempt.update({
      where: { id: attemptId },
      data: {
        score,
        passed,
        pendingManualGrade: false,
        status: passed ? "PASSED" : "FAILED",
        completedAt: attempt.completedAt ?? now,
      },
    });
  });

  const updated = await prisma.examAttempt.findUnique({
    where: { id: attemptId },
    select: { passed: true, score: true, exam: true, userId: true },
  });

  if (
    updated?.passed &&
    updated.exam.courseId &&
    !holdsGradesUntilAdminPublish(updated.exam.gradeVisibility)
  ) {
    const rule = await prisma.certificationRule.findFirst({
      where: { courseId: updated.exam.courseId },
    });
    if (rule) {
      const expires = new Date();
      expires.setMonth(expires.getMonth() + rule.validityMonths);
      await prisma.certification.upsert({
        where: {
          userId_ruleId: { userId: updated.userId, ruleId: rule.id },
        },
        update: {
          status: "EARNED",
          issuedAt: new Date(),
          expiresAt: expires,
        },
        create: {
          userId: updated.userId,
          ruleId: rule.id,
          title: rule.title,
          status: "EARNED",
          issuedAt: new Date(),
          expiresAt: expires,
        },
      });
    }
  }

  revalidatePath("/admin/grades");
  revalidatePath("/admin/grading");
  revalidatePath(`/admin/grading/${attemptId}`);
  revalidatePath("/exams");
  revalidatePath(`/exams/${attempt.examId}/results`);

  return {
    success: true as const,
    score: updated?.score ?? 0,
    passed: updated?.passed ?? false,
  };
}

/** @deprecated Use saveAttemptGrades — kept for any stale callers */
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
    include: { examAnswers: true },
  });
  if (!attempt?.pendingManualGrade) {
    return { error: "Use Save grades on the grading page for this attempt." };
  }

  const grades = attempt.examAnswers.map((a) => ({
    questionId: a.questionId,
    score:
      a.questionId === questionId
        ? manualScore
        : (a.manualScore ?? a.autoScore ?? 0),
    feedback: a.questionId === questionId ? feedback : undefined,
  }));

  return saveAttemptGrades(attemptId, grades);
}
