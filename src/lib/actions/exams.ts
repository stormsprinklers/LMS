"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth-utils";
import { revalidatePath } from "next/cache";

export async function startExamAttempt(examId: string) {
  const session = await requireUser();
  const attempt = await prisma.examAttempt.create({
    data: {
      userId: session.user.id,
      examId,
      status: "IN_PROGRESS",
    },
  });
  return attempt.id;
}

export async function submitExamAttempt(
  attemptId: string,
  answers: Record<string, string>,
) {
  const session = await requireUser();
  const attempt = await prisma.examAttempt.findFirst({
    where: { id: attemptId, userId: session.user.id },
    include: {
      exam: {
        include: {
          questions: { include: { options: true } },
          lesson: { include: { module: { include: { course: true } } } },
        },
      },
    },
  });

  if (!attempt || attempt.status !== "IN_PROGRESS") {
    return { error: "Invalid attempt." };
  }

  let correct = 0;
  const total = attempt.exam.questions.length;

  for (const q of attempt.exam.questions) {
    const selected = answers[q.id];
    const right = q.options.find((o) => o.isCorrect);
    if (right && selected === right.id) correct++;
  }

  const score = total > 0 ? Math.round((correct / total) * 100) : 0;
  const passed = score >= attempt.exam.passingScore;

  await prisma.examAttempt.update({
    where: { id: attemptId },
    data: {
      score,
      passed,
      status: passed ? "PASSED" : "FAILED",
      completedAt: new Date(),
      answers,
    },
  });

  if (passed) {
    const rule = await prisma.certificationRule.findFirst({
      where: { courseId: attempt.exam.lesson.module.course.id },
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

  return { score, passed, total };
}
