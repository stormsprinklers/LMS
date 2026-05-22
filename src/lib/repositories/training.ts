import { prisma } from "@/lib/db";
import { toVideoTrainingDTO } from "@/lib/mappers";
import type { VideoTraining } from "@/lib/types";

export async function getVideoTrainingsForUser(
  userId: string,
): Promise<VideoTraining[]> {
  const lessons = await prisma.lesson.findMany({
    where: { type: "VIDEO" },
    include: {
      videoAsset: true,
      module: { include: { course: true } },
      progress: { where: { userId }, take: 1 },
    },
    orderBy: { title: "asc" },
  });

  return lessons.map((lesson) => {
    const prog = lesson.progress[0];
    const duration = lesson.durationMinutes ?? 0;
    const watchedSeconds = prog?.watchedSeconds ?? 0;
    const watchedPercent =
      duration > 0
        ? Math.min(
            100,
            Math.round((watchedSeconds / (duration * 60)) * 100),
          )
        : prog?.status === "COMPLETED"
          ? 100
          : 0;

    return toVideoTrainingDTO({
      id: lesson.id,
      title: lesson.title,
      durationMinutes: lesson.durationMinutes,
      courseSlug: lesson.module.course.slug,
      courseTitle: lesson.module.course.title,
      watchedPercent,
    });
  });
}

export async function getLessonForPlayback(lessonId: string, userId: string) {
  return prisma.lesson.findFirst({
    where: { id: lessonId, type: "VIDEO" },
    include: {
      videoAsset: true,
      module: { include: { course: true } },
      progress: { where: { userId }, take: 1 },
    },
  });
}
