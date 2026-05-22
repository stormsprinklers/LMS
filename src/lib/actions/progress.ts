"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth-utils";
import { revalidatePath } from "next/cache";

export async function updateVideoProgress(
  lessonId: string,
  watchedSeconds: number,
) {
  const session = await requireUser();
  const userId = session.user.id;

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { module: { include: { course: true } } },
  });
  if (!lesson || lesson.type !== "VIDEO") return;

  const durationSec = (lesson.durationMinutes ?? 0) * 60;
  const status =
    durationSec > 0 && watchedSeconds >= durationSec * 0.9
      ? "COMPLETED"
      : watchedSeconds > 0
        ? "IN_PROGRESS"
        : "NOT_STARTED";

  await prisma.lessonProgress.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    update: { watchedSeconds, status },
    create: { userId, lessonId, watchedSeconds, status },
  });

  revalidatePath(`/courses/${lesson.module.course.slug}`);
  revalidatePath("/training");
}
