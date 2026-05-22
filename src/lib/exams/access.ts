import { prisma } from "@/lib/db";

export async function userCanTakeExam(userId: string, examId: string) {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: {
      lesson: { include: { module: true } },
      assignments: { where: { userId } },
    },
  });
  if (!exam || !exam.published) return { allowed: false, reason: "Exam not found" };

  const assignment = exam.assignments[0];
  if (assignment) return { allowed: true, exam };

  if (exam.lessonId && exam.lesson) {
    const enrollment = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: { userId, courseId: exam.lesson.module.courseId },
      },
    });
    if (!enrollment) {
      return { allowed: false, reason: "Not enrolled in course" };
    }
    const priorLessons = await prisma.lesson.findMany({
      where: {
        module: { courseId: exam.lesson.module.courseId },
        type: { not: "EXAM" },
      },
      include: { progress: { where: { userId }, take: 1 } },
    });
    const allComplete = priorLessons.every(
      (l) => l.progress[0]?.status === "COMPLETED",
    );
    if (!allComplete) {
      return { allowed: false, reason: "Complete prior lessons first" };
    }
    return { allowed: true, exam };
  }

  return { allowed: false, reason: "Not assigned to this exam" };
}

export function shuffleQuestionIds(ids: string[]) {
  const arr = [...ids];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
