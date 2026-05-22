"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth-utils";
import { revalidatePath } from "next/cache";
import {
  gradeAnswer,
  parseSubmittedAnswer,
  finalizeAttemptScore,
} from "@/lib/exams/grade-attempt";
import { userCanTakeExam, shuffleQuestionIds } from "@/lib/exams/access";
import { effectiveAttemptsAllowed } from "@/lib/exams/attempt-state";
import type { Prisma } from "@prisma/client";

export async function startExamAttempt(examId: string) {
  const session = await requireUser();
  const access = await userCanTakeExam(session.user.id, examId);
  if (!access.allowed) return { error: access.reason };

  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: { questions: { orderBy: { sortOrder: "asc" } } },
  });
  if (!exam) return { error: "Exam not found" };

  const attempts = await prisma.examAttempt.count({
    where: {
      userId: session.user.id,
      examId,
      status: { in: ["PASSED", "FAILED", "SUBMITTED_PENDING_GRADE"] },
    },
  });
  const limit = effectiveAttemptsAllowed(exam.attemptsAllowed);
  if (attempts >= limit) {
    return { error: "No attempts remaining" };
  }

  const questionIds = exam.questions.map((q) => q.id);
  const order = exam.shuffleQuestions
    ? shuffleQuestionIds(questionIds)
    : questionIds;

  const attempt = await prisma.examAttempt.create({
    data: {
      userId: session.user.id,
      examId,
      questionOrder: order,
    },
  });
  return { attemptId: attempt.id };
}

export async function submitExamAttempt(
  attemptId: string,
  answers: Record<string, unknown>,
) {
  const session = await requireUser();
  const attempt = await prisma.examAttempt.findFirst({
    where: { id: attemptId, userId: session.user.id },
    include: {
      exam: {
        include: {
          questions: { include: { options: true } },
        },
      },
    },
  });

  if (!attempt || attempt.status !== "IN_PROGRESS") {
    return { error: "Invalid attempt." };
  }

  const existingAnswers = await prisma.examAnswer.count({
    where: { attemptId },
  });
  if (existingAnswers > 0) {
    return { error: "This attempt was already submitted." };
  }

  const order = Array.isArray(attempt.questionOrder)
    ? (attempt.questionOrder as string[])
    : [];
  let questions = order.length
    ? attempt.exam.questions.filter((q) => order.includes(q.id))
    : [...attempt.exam.questions];
  if (questions.length === 0) {
    questions = [...attempt.exam.questions];
  }

  if (questions.length === 0) {
    return { error: "This exam has no questions." };
  }

  let needsManual = false;
  const answerRows: { autoScore: number | null; manualScore: number | null }[] =
    [];

  for (const question of questions) {
    const raw = answers[question.id];
    const parsed = parseSubmittedAnswer(question, raw);
    const { autoScore, needsManual: manual } = gradeAnswer(question, parsed);

    await prisma.examAnswer.create({
      data: {
        attemptId,
        questionId: question.id,
        value: parsed as Prisma.InputJsonValue,
        autoScore,
      },
    });
    answerRows.push({ autoScore, manualScore: null });

    if (manual) {
      needsManual = true;
      const courseAdmins = attempt.exam.courseId
        ? await prisma.courseAdmin.findMany({
            where: { courseId: attempt.exam.courseId },
          })
        : [];
      const graders =
        courseAdmins.length > 0
          ? courseAdmins
          : await prisma.examGrader.findMany({ where: { examId: attempt.examId } });
      const fallbackAdmins = await prisma.user.findMany({
        where: { role: "ADMIN" },
        take: 5,
      });
      const notifyUsers =
        graders.length > 0
          ? graders.map((g) => g.userId)
          : fallbackAdmins.map((a) => a.id);

      for (const graderId of notifyUsers) {
        await prisma.gradingTask.create({
          data: {
            attemptId,
            questionId: question.id,
            courseId: attempt.exam.courseId,
            assignedToUserId: graderId,
          },
        });
        await prisma.notification.create({
          data: {
            userId: graderId,
            type: "FREE_RESPONSE_TO_GRADE",
            title: `Grade free response: ${attempt.exam.title}`,
            body: `${session.user.name ?? session.user.email} submitted a response for manual grading.`,
            link: `/admin/grading/${attemptId}`,
            metadata: { attemptId, questionId: question.id },
          },
        });
      }
    }
  }

  if (needsManual) {
    await prisma.examAttempt.update({
      where: { id: attemptId },
      data: {
        status: "SUBMITTED_PENDING_GRADE",
        pendingManualGrade: true,
        completedAt: new Date(),
        answers: answers as Prisma.InputJsonValue,
      },
    });
    revalidatePath("/exams");
    return { pendingReview: true };
  }

  const { score, passed } = await finalizeAttemptScore(
    attempt.exam,
    answerRows,
  );

  await prisma.examAttempt.update({
    where: { id: attemptId },
    data: {
      score,
      passed,
      status: passed ? "PASSED" : "FAILED",
      completedAt: new Date(),
      answers: answers as Prisma.InputJsonValue,
    },
  });

  const courseId =
    attempt.exam.courseId ??
    (await prisma.lesson.findUnique({
      where: { id: attempt.exam.lessonId ?? "" },
      include: { module: true },
    }))?.module.courseId;

  if (passed && courseId) {
    const rule = await prisma.certificationRule.findFirst({
      where: { courseId },
    });
    if (rule) {
      const expires = new Date();
      expires.setMonth(expires.getMonth() + rule.validityMonths);
      await prisma.certification.upsert({
        where: {
          userId_ruleId: { userId: session.user.id, ruleId: rule.id },
        },
        update: {
          status: "EARNED",
          issuedAt: new Date(),
          expiresAt: expires,
        },
        create: {
          userId: session.user.id,
          ruleId: rule.id,
          title: rule.title,
          status: "EARNED",
          issuedAt: new Date(),
          expiresAt: expires,
        },
      });
    }
  }

  revalidatePath("/exams");
  revalidatePath("/certifications");

  return { score, passed, total: questions.length };
}
