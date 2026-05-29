import { getLearnerCourseCurriculum, type LearnerCourseItem } from "@/lib/repositories/course-learner";
import { prisma } from "@/lib/db";

export type CourseItemNavLink = {
  courseItemId: string;
  title: string;
  href: string;
  itemType: LearnerCourseItem["itemType"];
  access: LearnerCourseItem["access"];
};

export type CourseItemNavigation = {
  courseSlug: string;
  courseTitle: string;
  current: CourseItemNavLink;
  previous: CourseItemNavLink | null;
  next: CourseItemNavLink | null;
  position: number;
  total: number;
};

function toNavLink(
  item: LearnerCourseItem,
  courseSlug: string,
  preview: boolean,
): CourseItemNavLink {
  const previewQuery = preview ? "?preview=1" : "";
  return {
    courseItemId: item.id,
    title: item.title,
    href:
      item.access === "locked" ?
        `/courses/${courseSlug}${previewQuery}`
      : item.href,
    itemType: item.itemType,
    access: item.access,
  };
}

export async function getCourseItemNavigation(
  courseSlug: string,
  courseItemId: string,
  userId: string,
  preview = false,
): Promise<CourseItemNavigation | null> {
  const course = await getLearnerCourseCurriculum(courseSlug, userId, preview);
  if (!course) return null;

  const flat = course.modules.flatMap((m) => m.items);
  const index = flat.findIndex((i) => i.id === courseItemId);
  if (index < 0) return null;

  const current = flat[index];
  const prev = index > 0 ? flat[index - 1] : null;
  const next = index < flat.length - 1 ? flat[index + 1] : null;

  return {
    courseSlug: course.slug,
    courseTitle: course.title,
    current: toNavLink(current, course.slug, preview),
    previous: prev ? toNavLink(prev, course.slug, preview) : null,
    next: next ? toNavLink(next, course.slug, preview) : null,
    position: index + 1,
    total: flat.length,
  };
}

export async function getCourseItemNavigationByExamId(
  examId: string,
  userId: string,
  preview = false,
): Promise<(CourseItemNavigation & { preview: boolean }) | null> {
  const item = await prisma.courseItem.findFirst({
    where: { examId, archived: false },
    select: { id: true, course: { select: { slug: true } } },
  });
  if (!item) return null;

  const nav = await getCourseItemNavigation(
    item.course.slug,
    item.id,
    userId,
    preview,
  );
  if (!nav) return null;
  return { ...nav, preview };
}
