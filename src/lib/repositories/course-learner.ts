import { prisma } from "@/lib/db";
import {
  arePriorRequiredItemsComplete,
  getCourseProgressMap,
  getItemAccessState,
  isModuleUnlocked,
} from "@/lib/courses/completion";
import type { CourseItemType, ContentStatus } from "@prisma/client";

export type LearnerCourseItem = {
  id: string;
  title: string;
  itemType: CourseItemType;
  sortOrder: number;
  estimatedMinutes: number | null;
  isRequired: boolean;
  track: string;
  access: "locked" | "available" | "in_progress" | "completed";
  href: string;
  examId?: string | null;
  legacyLessonId?: string | null;
};

export type LearnerModule = {
  id: string;
  title: string;
  description: string | null;
  sortOrder: number;
  unlocked: boolean;
  items: LearnerCourseItem[];
};

export async function getLearnerCourseCurriculum(
  slug: string,
  userId: string,
  preview = false,
) {
  const itemStatuses: ContentStatus[] = preview
    ? ["DRAFT", "READY", "PUBLISHED"]
    : ["PUBLISHED", "READY"];

  const course = await prisma.course.findFirst({
    where: preview
      ? { slug, archived: false }
      : { slug, archived: false, published: true, status: "PUBLISHED" },
    include: {
      settings: true,
      modules: {
        orderBy: { sortOrder: "asc" },
        include: {
          courseItems: {
            where: { archived: false, status: { in: itemStatuses } },
            orderBy: { sortOrder: "asc" },
            include: {
              exam: { select: { id: true } },
              legacyLesson: { select: { id: true } },
            },
          },
        },
      },
    },
  });

  if (!course) return null;

  if (!preview) {
    const mode = course.settings?.enrollmentMode ?? "MANUAL";
    if (mode === "MANUAL") {
      const enrolled = await prisma.enrollment.findUnique({
        where: { userId_courseId: { userId, courseId: course.id } },
      });
      if (!enrolled) return null;
    }
  }

  const progressMap = await getCourseProgressMap(userId, course.id);

  const modules: LearnerModule[] = [];

  for (const mod of course.modules) {
    const moduleUnlocked = preview
      ? true
      : await isModuleUnlocked(
          userId,
          course.id,
          mod.id,
          mod.sortOrder,
          mod.unlockRule,
        );

    const items: LearnerCourseItem[] = [];
    for (const item of mod.courseItems) {
      const priorComplete = preview
        ? true
        : await arePriorRequiredItemsComplete(
            userId,
            course.id,
            mod.id,
            item.sortOrder,
            progressMap,
          );
      const p = progressMap.get(item.id);
      const access = preview
        ? ("available" as const)
        : getItemAccessState(p?.status, moduleUnlocked, priorComplete);

      const previewQuery = preview ? "?preview=1" : "";
      let href = `/courses/${slug}/items/${item.id}${previewQuery}`;
      if (item.itemType === "EXAM" || item.itemType === "QUIZ") {
        href = item.exam?.id ? `/exams/${item.exam.id}/take` : "/exams";
      } else if (item.itemType === "VIDEO" && item.legacyLessonId) {
        href = `/courses/${slug}/lessons/${item.legacyLessonId}${previewQuery}`;
      }

      items.push({
        id: item.id,
        title: item.title,
        itemType: item.itemType,
        sortOrder: item.sortOrder,
        estimatedMinutes: item.estimatedMinutes,
        isRequired: item.isRequired,
        track: item.track,
        access,
        href: access === "locked" ? "#" : href,
        examId: item.exam?.id,
        legacyLessonId: item.legacyLessonId,
      });
    }

    modules.push({
      id: mod.id,
      title: mod.title,
      description: mod.description,
      sortOrder: mod.sortOrder,
      unlocked: moduleUnlocked,
      items,
    });
  }

  const allItems = modules.flatMap((m) => m.items);
  const completed = allItems.filter((i) => i.access === "completed").length;
  const progress = allItems.length > 0 ? Math.round((completed / allItems.length) * 100) : 0;

  return {
    id: course.id,
    slug: course.slug,
    title: course.title,
    description: course.description,
    shortDescription: course.shortDescription,
    category: course.category,
    estimatedHours: course.estimatedHours,
    estimatedMinutes: course.estimatedMinutes,
    progress,
    modules,
    itemCount: allItems.length,
  };
}
