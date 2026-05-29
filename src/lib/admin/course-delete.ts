import { prisma } from "@/lib/db";
import type { AiSourceAssetKind } from "@prisma/client";

const LIBRARY_MEDIA_KINDS: AiSourceAssetKind[] = ["image", "video"];

export type CourseDeletePreview = {
  exams: { id: string; title: string }[];
  libraryMedia: { id: string; title: string; kind: AiSourceAssetKind }[];
};

export async function getCourseDeleteRelatedIds(
  courseId: string,
): Promise<{ examIds: string[]; libraryMediaIds: string[] }> {
  const courseItems = await prisma.courseItem.findMany({
    where: { courseId },
    select: { id: true, examId: true },
  });
  const itemIds = courseItems.map((i) => i.id);
  const examIdsFromItems = courseItems
    .map((i) => i.examId)
    .filter((id): id is string => !!id);

  const exams = await prisma.exam.findMany({
    where: {
      OR: [{ courseId }, { id: { in: examIdsFromItems } }],
    },
    select: { id: true },
  });

  const libraryMedia = await prisma.libraryAsset.findMany({
    where: {
      kind: { in: LIBRARY_MEDIA_KINDS },
      OR: [
        { sourceCourseId: courseId },
        ...(itemIds.length > 0 ? [{ sourceCourseItemId: { in: itemIds } }] : []),
      ],
    },
    select: { id: true },
  });

  return {
    examIds: [...new Set(exams.map((e) => e.id))],
    libraryMediaIds: libraryMedia.map((a) => a.id),
  };
}

export async function getCourseDeletePreview(
  courseId: string,
): Promise<CourseDeletePreview | null> {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true },
  });
  if (!course) return null;

  const { examIds, libraryMediaIds } = await getCourseDeleteRelatedIds(courseId);

  const [exams, libraryMedia] = await Promise.all([
    examIds.length > 0
      ? prisma.exam.findMany({
          where: { id: { in: examIds } },
          select: { id: true, title: true },
          orderBy: { title: "asc" },
        })
      : [],
    libraryMediaIds.length > 0
      ? prisma.libraryAsset.findMany({
          where: { id: { in: libraryMediaIds } },
          select: { id: true, title: true, kind: true },
          orderBy: { title: "asc" },
        })
      : [],
  ]);

  return { exams, libraryMedia };
}
