import { prisma } from "@/lib/db";
import type { Exam } from "@/lib/types";
import { userCanTakeExam } from "@/lib/exams/access";

async function resolveExamStatus(
  userId: string,
  examId: string,
): Promise<Exam["status"]> {
  const inProgress = await prisma.examAttempt.findFirst({
    where: { userId, examId, status: "IN_PROGRESS" },
  });
  if (inProgress) return "in_progress";

  const passed = await prisma.examAttempt.findFirst({
    where: { userId, examId, passed: true },
  });
  if (passed) return "passed";

  const pending = await prisma.examAttempt.findFirst({
    where: { userId, examId, status: "SUBMITTED_PENDING_GRADE" },
  });
  if (pending) return "pending";

  const access = await userCanTakeExam(userId, examId);
  if (!access.allowed) return "locked";

  const failed = await prisma.examAttempt.findFirst({
    where: { userId, examId, passed: false, status: "FAILED" },
  });
  if (failed) return "failed";

  return "available";
}

function mapExam(
  exam: {
    id: string;
    title: string;
    passingScore: number;
    timeLimitMinutes: number;
    attemptsAllowed: number;
    course?: { slug: string; title: string } | null;
    lesson?: { module: { course: { slug: string; title: string } } } | null;
  },
  status: Exam["status"],
  questionCount: number,
): Exam {
  return {
    id: exam.id,
    title: exam.title,
    courseId: exam.course?.slug ?? exam.lesson?.module.course.slug ?? "",
    courseTitle:
      exam.course?.title ?? exam.lesson?.module.course.title ?? "Standalone",
    questionCount,
    passingScore: exam.passingScore,
    timeLimitMinutes: exam.timeLimitMinutes,
    attemptsAllowed: exam.attemptsAllowed,
    status,
  };
}

export async function getExamsForUser(userId: string): Promise<Exam[]> {
  const seen = new Set<string>();
  const result: Exam[] = [];

  const assigned = await prisma.exam.findMany({
    where: { published: true, archived: false, assignments: { some: { userId } } },
    include: {
      course: true,
      lesson: { include: { module: { include: { course: true } } } },
      _count: { select: { questions: true } },
    },
  });

  for (const exam of assigned) {
    seen.add(exam.id);
    const status = await resolveExamStatus(userId, exam.id);
    result.push(mapExam(exam, status, exam._count.questions));
  }

  const lessonExams = await prisma.exam.findMany({
    where: { lessonId: { not: null }, published: true, archived: false },
    include: {
      course: true,
      lesson: { include: { module: { include: { course: true } } } },
      _count: { select: { questions: true } },
    },
  });

  for (const exam of lessonExams) {
    if (seen.has(exam.id)) continue;
    const access = await userCanTakeExam(userId, exam.id);
    if (!access.allowed) continue;
    seen.add(exam.id);
    const status = await resolveExamStatus(userId, exam.id);
    result.push(mapExam(exam, status, exam._count.questions));
  }

  return result;
}

export async function getExamForTake(examId: string, userId: string) {
  const access = await userCanTakeExam(userId, examId);
  if (!access.allowed) return null;

  return prisma.exam.findUnique({
    where: { id: examId },
    include: {
      questions: {
        orderBy: { sortOrder: "asc" },
        include: { options: { orderBy: { sortOrder: "asc" } } },
      },
      lesson: { include: { module: { include: { course: true } } } },
      course: true,
    },
  });
}

export async function getExamAttempts(userId: string, examId: string) {
  return prisma.examAttempt.findMany({
    where: { userId, examId },
    orderBy: { startedAt: "desc" },
  });
}

export async function countAttempts(userId: string, examId: string) {
  return prisma.examAttempt.count({
    where: {
      userId,
      examId,
      status: { in: ["PASSED", "FAILED", "SUBMITTED_PENDING_GRADE"] },
    },
  });
}

export async function getExamByIdForResults(examId: string) {
  return prisma.exam.findUnique({
    where: { id: examId },
    include: {
      lesson: { include: { module: { include: { course: true } } } },
      course: true,
    },
  });
}

export async function getAttemptWithAnswers(attemptId: string, userId: string) {
  return prisma.examAttempt.findFirst({
    where: { id: attemptId, userId },
    include: {
      exam: true,
      examAnswers: {
        include: { question: { include: { options: true } } },
      },
    },
  });
}
