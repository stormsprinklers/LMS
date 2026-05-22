import { prisma } from "@/lib/db";
import { toExamDTO } from "@/lib/mappers";
import type { Exam } from "@/lib/types";

async function resolveExamStatus(
  userId: string,
  examId: string,
  lessonId: string,
  courseId: string,
): Promise<Exam["status"]> {
  const passed = await prisma.examAttempt.findFirst({
    where: { userId, examId, passed: true },
  });
  if (passed) return "passed";

  const priorLessons = await prisma.lesson.findMany({
    where: {
      module: { courseId },
      type: { not: "EXAM" },
    },
    include: { progress: { where: { userId }, take: 1 } },
  });

  const allComplete = priorLessons.every(
    (l) => l.progress[0]?.status === "COMPLETED",
  );
  if (!allComplete) return "locked";

  const failed = await prisma.examAttempt.findFirst({
    where: { userId, examId, passed: false, status: "FAILED" },
  });
  if (failed) return "failed";

  return "available";
}

export async function getExamsForUser(userId: string): Promise<Exam[]> {
  const exams = await prisma.exam.findMany({
    include: {
      lesson: {
        include: {
          module: { include: { course: true } },
        },
      },
      _count: { select: { questions: true } },
    },
  });

  const result: Exam[] = [];
  for (const exam of exams) {
    const course = exam.lesson.module.course;
    const status = await resolveExamStatus(
      userId,
      exam.id,
      exam.lessonId,
      course.id,
    );
    result.push(
      toExamDTO({
        id: exam.id,
        title: exam.title,
        courseSlug: course.slug,
        courseTitle: course.title,
        questionCount: exam._count.questions,
        passingScore: exam.passingScore,
        timeLimitMinutes: exam.timeLimitMinutes,
        attemptsAllowed: exam.attemptsAllowed,
        status,
      }),
    );
  }
  return result;
}

export async function getExamForTake(examId: string, userId: string) {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: {
      questions: {
        orderBy: { sortOrder: "asc" },
        include: { options: { orderBy: { sortOrder: "asc" } } },
      },
      lesson: { include: { module: { include: { course: true } } } },
    },
  });
  if (!exam) return null;

  const status = await resolveExamStatus(
    userId,
    exam.id,
    exam.lessonId,
    exam.lesson.module.course.id,
  );

  return { exam, status };
}

export async function getExamAttempts(userId: string, examId: string) {
  return prisma.examAttempt.findMany({
    where: { userId, examId },
    orderBy: { startedAt: "desc" },
  });
}

export async function countAttempts(userId: string, examId: string) {
  return prisma.examAttempt.count({
    where: { userId, examId, status: { in: ["PASSED", "FAILED"] } },
  });
}
