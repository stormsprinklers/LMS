import { prisma } from "@/lib/db";

/** Exams with 0 attempts (bad admin input) are treated as at least 1. */
export function effectiveAttemptsAllowed(attemptsAllowed: number) {
  if (!Number.isFinite(attemptsAllowed) || attemptsAllowed < 1) {
    return 3;
  }
  return Math.floor(attemptsAllowed);
}

export async function countCompletedAttempts(userId: string, examId: string) {
  return prisma.examAttempt.count({
    where: {
      userId,
      examId,
      status: { in: ["PASSED", "FAILED", "SUBMITTED_PENDING_GRADE"] },
    },
  });
}

export async function getInProgressAttempt(userId: string, examId: string) {
  return prisma.examAttempt.findFirst({
    where: { userId, examId, status: "IN_PROGRESS" },
    orderBy: { startedAt: "desc" },
  });
}

export async function getRemainingAttempts(
  userId: string,
  examId: string,
  attemptsAllowed: number,
) {
  const limit = effectiveAttemptsAllowed(attemptsAllowed);
  const completed = await countCompletedAttempts(userId, examId);
  return Math.max(0, limit - completed);
}

export function resolveQuestionOrder<T extends { id: string }>(
  questionOrder: unknown,
  questions: T[],
): T[] {
  const order = Array.isArray(questionOrder)
    ? (questionOrder as string[])
    : [];
  if (order.length === 0) return questions;

  const mapped = order
    .map((qid) => questions.find((q) => q.id === qid))
    .filter((q): q is T => q !== undefined);

  return mapped.length > 0 ? mapped : questions;
}
