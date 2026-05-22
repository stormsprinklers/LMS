import { prisma } from "@/lib/db";

export async function userCanTakeExam(userId: string, examId: string) {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: {
      lesson: { include: { module: { include: { course: true } } } },
      course: true,
      assignments: { where: { userId } },
    },
  });
  if (!exam || !exam.published || exam.archived) {
    return { allowed: false, reason: "Exam not found" };
  }
  if (exam.course?.archived) {
    return { allowed: false, reason: "Course not available" };
  }

  const assignment = exam.assignments[0];
  if (assignment) return { allowed: true, exam };

  const courseId = exam.courseId ?? exam.lesson?.module?.courseId;
  if (courseId) {
    const settings = await prisma.courseSettings.findUnique({
      where: { courseId },
    });
    if ((settings?.enrollmentMode ?? "MANUAL") === "MANUAL") {
      const enrollment = await prisma.enrollment.findUnique({
        where: { userId_courseId: { userId, courseId } },
      });
      if (!enrollment) {
        return { allowed: false, reason: "Not enrolled in course" };
      }
    }

    const examItem = await prisma.courseItem.findFirst({
      where: { examId: exam.id, archived: false },
      select: { id: true, moduleId: true, sortOrder: true },
    });

    if (examItem) {
      const examMod = await prisma.module.findUnique({
        where: { id: examItem.moduleId },
        select: { sortOrder: true },
      });
      const allItems = await prisma.courseItem.findMany({
        where: { courseId, archived: false, isRequired: true },
        include: { module: { select: { sortOrder: true } } },
      });
      const priorItems = allItems.filter((item) => {
        if (item.id === examItem.id) return false;
        if (item.module.sortOrder < (examMod?.sortOrder ?? 0)) return true;
        if (
          item.moduleId === examItem.moduleId &&
          item.sortOrder < examItem.sortOrder
        ) {
          return true;
        }
        return false;
      });
      const progress = await prisma.courseItemProgress.findMany({
        where: {
          userId,
          courseItemId: { in: priorItems.map((p) => p.id) },
          status: "COMPLETED",
        },
      });
      if (progress.length < priorItems.length) {
        return { allowed: false, reason: "Complete prior course items first" };
      }
    } else if (exam.lessonId && exam.lesson) {
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
      if (!allComplete) {
        return { allowed: false, reason: "Complete prior lessons first" };
      }
    }
    return { allowed: true, exam };
  }

  return { allowed: false, reason: "Not assigned to this exam" };
}

export function shuffleQuestionIds(ids: string[]) {
  return shuffleIdsWithRng(ids, () => Math.random());
}

/** Stable shuffle for a given seed (e.g. attempt + question id). */
export function shuffleIdsDeterministic(ids: string[], seed: string) {
  return shuffleIdsWithRng(ids, mulberry32(hashString(seed)));
}

function shuffleIdsWithRng<T>(items: T[], random: () => number): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function hashString(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(31, h) + s.charCodeAt(i);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const OPTION_SHUFFLE_TYPES = new Set(["MULTIPLE_CHOICE", "MULTIPLE_SELECT"]);

export function shuffleOptionsForTake<T extends { id: string }>(
  questionType: string,
  options: T[],
  attemptId: string,
  questionId: string,
): T[] {
  if (!OPTION_SHUFFLE_TYPES.has(questionType) || options.length < 2) {
    return options;
  }
  const order = shuffleIdsDeterministic(
    options.map((o) => o.id),
    `${attemptId}:${questionId}`,
  );
  const byId = new Map(options.map((o) => [o.id, o]));
  return order.map((id) => byId.get(id)!).filter(Boolean);
}
