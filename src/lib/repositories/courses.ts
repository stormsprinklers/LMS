import { prisma } from "@/lib/db";
import { toCourseDTO, type CourseWithRelations } from "@/lib/mappers";
import type { Course } from "@/lib/types";

const courseInclude = (userId?: string) => ({
  modules: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      lessons: {
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
    where: { published: true },
    include: courseInclude(userId),
    orderBy: { title: "asc" },
  });

  return courses.map((c) =>
    toCourseDTO(c as unknown as CourseWithRelations),
  );
}

export async function getCourseBySlug(
  slug: string,
  userId: string,
): Promise<Course | null> {
  const course = await prisma.course.findUnique({
    where: { slug },
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

export async function listCoursesAdmin() {
  return prisma.course.findMany({
    orderBy: { title: "asc" },
    include: {
      modules: { include: { _count: { select: { lessons: true } } } },
    },
  });
}
