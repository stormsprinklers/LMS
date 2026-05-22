import { prisma } from "@/lib/db";
import type { LessonProgressStatus } from "@prisma/client";

export type ItemAccessState = "locked" | "available" | "in_progress" | "completed";

export async function getCourseProgressMap(userId: string, courseId: string) {
  const items = await prisma.courseItem.findMany({
    where: { courseId, archived: false },
    select: { id: true },
  });
  const progress = await prisma.courseItemProgress.findMany({
    where: { userId, courseItemId: { in: items.map((i) => i.id) } },
  });
  return new Map(progress.map((p) => [p.courseItemId, p]));
}

export async function isModuleUnlocked(
  userId: string,
  courseId: string,
  moduleId: string,
  moduleSortOrder: number,
  unlockRule: string,
): Promise<boolean> {
  if (unlockRule === "ALWAYS" || moduleSortOrder === 0) return true;
  if (unlockRule === "MANUAL") return false;

  const modules = await prisma.module.findMany({
    where: { courseId },
    orderBy: { sortOrder: "asc" },
    include: {
      courseItems: {
        where: { archived: false, isRequired: true },
      },
    },
  });
  const idx = modules.findIndex((m) => m.id === moduleId);
  if (idx <= 0) return true;
  const prev = modules[idx - 1];
  const progress = await getCourseProgressMap(userId, courseId);

  if (unlockRule === "PREVIOUS_MODULE_COMPLETE") {
    for (const item of prev.courseItems) {
      const p = progress.get(item.id);
      if (p?.status !== "COMPLETED") return false;
    }
    return true;
  }

  return false;
}

export function getItemAccessState(
  progressStatus: LessonProgressStatus | undefined,
  moduleUnlocked: boolean,
  priorRequiredComplete: boolean,
): ItemAccessState {
  if (!moduleUnlocked || !priorRequiredComplete) return "locked";
  if (progressStatus === "COMPLETED") return "completed";
  if (progressStatus === "IN_PROGRESS") return "in_progress";
  return "available";
}

export async function markCourseItemViewed(userId: string, courseItemId: string) {
  const item = await prisma.courseItem.findUnique({
    where: { id: courseItemId },
    select: { completionRule: true },
  });
  if (!item) return;
  const status =
    item.completionRule === "viewed" || item.completionRule === "manual"
      ? "COMPLETED"
      : "IN_PROGRESS";
  await prisma.courseItemProgress.upsert({
    where: { userId_courseItemId: { userId, courseItemId } },
    create: { userId, courseItemId, status },
    update: { status, updatedAt: new Date() },
  });
}

export async function updateVideoItemProgress(
  userId: string,
  courseItemId: string,
  watchedSeconds: number,
  durationMinutes: number | null,
) {
  const item = await prisma.courseItem.findUnique({
    where: { id: courseItemId },
    include: { videoLesson: true, legacyLesson: { include: { videoAsset: true } } },
  });
  if (!item) return;

  const durationSec =
    item.videoLesson?.durationSeconds ??
    item.legacyLesson?.videoAsset?.durationSeconds ??
    (durationMinutes ? durationMinutes * 60 : 0);
  const requiredPct = item.videoLesson?.requiredWatchPercent ?? 80;
  const threshold = durationSec > 0 ? (durationSec * requiredPct) / 100 : 0;
  const completed = watchedSeconds >= threshold && threshold > 0;

  await prisma.courseItemProgress.upsert({
    where: { userId_courseItemId: { userId, courseItemId } },
    create: {
      userId,
      courseItemId,
      watchedSeconds,
      status: completed ? "COMPLETED" : "IN_PROGRESS",
    },
    update: {
      watchedSeconds,
      status: completed ? "COMPLETED" : "IN_PROGRESS",
      updatedAt: new Date(),
    },
  });
}

export async function arePriorRequiredItemsComplete(
  userId: string,
  courseId: string,
  moduleId: string,
  itemSortOrder: number,
  progressMap: Map<string, { status: LessonProgressStatus }>,
): Promise<boolean> {
  const prior = await prisma.courseItem.findMany({
    where: {
      courseId,
      moduleId,
      archived: false,
      isRequired: true,
      sortOrder: { lt: itemSortOrder },
    },
  });
  return prior.every((p) => progressMap.get(p.id)?.status === "COMPLETED");
}
