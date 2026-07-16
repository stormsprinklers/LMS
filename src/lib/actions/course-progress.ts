"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth-utils";
import {
  markCourseItemViewed as markViewedInternal,
  updateVideoItemProgress,
} from "@/lib/courses/completion";
import { tryAwardCertification } from "@/lib/certifications/award";
import { revalidatePath } from "next/cache";

async function afterProgress(userId: string, courseId: string, slug: string) {
  try {
    await tryAwardCertification(userId, courseId);
  } catch (error) {
    console.error("Certification award check failed:", error);
  }
  revalidatePath(`/courses/${slug}`);
  revalidatePath("/certifications");
}

export async function markCourseItemComplete(courseItemId: string) {
  const session = await requireUser();
  const item = await prisma.courseItem.findUnique({
    where: { id: courseItemId },
    include: { course: { select: { id: true, slug: true } } },
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

  await afterProgress(session.user.id, item.course.id, item.course.slug);
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
    include: { course: { select: { id: true, slug: true } } },
  });
  if (!item) return;

  await updateVideoItemProgress(
    session.user.id,
    courseItemId,
    watchedSeconds,
    durationMinutes ?? item.estimatedMinutes,
  );

  await afterProgress(session.user.id, item.course.id, item.course.slug);
}

export async function markCourseItemViewed(courseItemId: string) {
  const session = await requireUser();
  const item = await prisma.courseItem.findUnique({
    where: { id: courseItemId },
    include: { course: { select: { id: true, slug: true } } },
  });
  if (!item) return;

  await markViewedInternal(session.user.id, courseItemId);
  await afterProgress(session.user.id, item.course.id, item.course.slug);
}
