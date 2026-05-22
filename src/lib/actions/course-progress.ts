"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth-utils";
import {
  markCourseItemViewed,
  updateVideoItemProgress,
} from "@/lib/courses/completion";
import { revalidatePath } from "next/cache";

export async function markCourseItemComplete(courseItemId: string) {
  const session = await requireUser();
  const item = await prisma.courseItem.findUnique({
    where: { id: courseItemId },
    include: { course: { select: { slug: true } } },
  });
  if (!item) return { error: "Not found" };

  await prisma.courseItemProgress.upsert({
    where: {
      userId_courseItemId: { userId: session.user.id, courseItemId },
    },
    create: {
      userId: session.user.id,
      courseItemId,
      status: "COMPLETED",
    },
    update: { status: "COMPLETED", updatedAt: new Date() },
  });

  revalidatePath(`/courses/${item.course.slug}`);
  return { success: true };
}

export async function updateCourseItemVideoProgress(
  courseItemId: string,
  watchedSeconds: number,
  durationMinutes?: number,
) {
  const session = await requireUser();
  const item = await prisma.courseItem.findUnique({
    where: { id: courseItemId },
    include: { course: { select: { slug: true } } },
  });
  if (!item) return;

  await updateVideoItemProgress(
    session.user.id,
    courseItemId,
    watchedSeconds,
    durationMinutes ?? item.estimatedMinutes,
  );

  revalidatePath(`/courses/${item.course.slug}`);
}

export { markCourseItemViewed };
