import { prisma } from "@/lib/db";
import { toCourseDTO, type CourseWithRelations } from "@/lib/mappers";
import type { Course } from "@/lib/types";

const courseInclude = (userId?: string) => ({
  modules: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      lessons: {
        where: { archived: false },
        orderBy: { sortOrder: "asc" as const },
        include: {
          progress: userId
            ? { where: { userId }, take: 1 }
            : false,
        },
      },
    },
  },
});

export async function getCoursesForUser(userId: string): Promise<Course[]> {
  const courses = await prisma.course.findMany({
    where: {
      published: true,
      archived: false,
      status: "PUBLISHED",
    },
    include: {
      ...courseInclude(userId),
      _count: { select: { courseItems: { where: { archived: false } } } },
      enrollments: { where: { userId }, take: 1 },
      settings: true,
    },
    orderBy: { title: "asc" },
  });

  const visible = courses.filter((c) => {
    const mode = c.settings?.enrollmentMode ?? "MANUAL";
    if (mode === "SELF_ENROLL" || mode === "AUTO") return true;
    return c.enrollments.length > 0;
  });

  return Promise.all(
    visible.map(async (c) => {
      const itemCount = c._count.courseItems;
      if (itemCount > 0) {
        const completed = await prisma.courseItemProgress.count({
          where: {
            userId,
            status: "COMPLETED",
            courseItem: { courseId: c.id, archived: false },
          },
        });
        const dto = toCourseDTO(c as unknown as CourseWithRelations);
        return {
          ...dto,
          lessonCount: itemCount,
          progress: itemCount > 0 ? Math.round((completed / itemCount) * 100) : 0,
        };
      }
      return toCourseDTO(c as unknown as CourseWithRelations);
    }),
  );
}

export async function getCourseBySlug(
  slug: string,
  userId: string,
): Promise<Course | null> {
  const course = await prisma.course.findFirst({
    where: { slug, archived: false, published: true },
    include: courseInclude(userId),
  });

  if (!course) return null;
  return toCourseDTO(course as unknown as CourseWithRelations);
}

export async function getCourseBySlugAdmin(slug: string) {
  return prisma.course.findUnique({
    where: { slug },
    include: {
      modules: {
        orderBy: { sortOrder: "asc" },
        include: {
          lessons: {
            orderBy: { sortOrder: "asc" },
            include: {
              videoAsset: true,
              manualAsset: true,
              exam: { include: { questions: { include: { options: true } } } },
            },
          },
        },
      },
    },
  });
}

export async function listCoursesAdmin(archived = false) {
  return prisma.course.findMany({
    where: { archived },
    orderBy: archived ? { archivedAt: "desc" } : { title: "asc" },
    include: {
      modules: { include: { _count: { select: { lessons: true, courseItems: true } } } },
    },
  });
}
