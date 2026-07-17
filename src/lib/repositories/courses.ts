import { prisma } from "@/lib/db";
import { isCourseComplete } from "@/lib/certifications/award";
import { toCourseDTO, type CourseWithRelations } from "@/lib/mappers";
import type { Course, CourseCertificationInfo } from "@/lib/types";

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

async function getCertificationInfoByCourseId(
  userId: string,
  courseIds: string[]
): Promise<Map<string, CourseCertificationInfo[]>> {
  const result = new Map<string, CourseCertificationInfo[]>();
  if (courseIds.length === 0) return result;

  const idSet = new Set(courseIds);

  const [primaryRules, asPrereq] = await Promise.all([
    prisma.certificationRule.findMany({
      where: {
        archived: false,
        enabled: true,
        courseId: { in: courseIds },
      },
      include: {
        prerequisites: { select: { requiredCourseId: true } },
      },
    }),
    prisma.certificationPrerequisite.findMany({
      where: { requiredCourseId: { in: courseIds } },
      include: {
        rule: {
          include: {
            prerequisites: { select: { requiredCourseId: true } },
          },
        },
      },
    }),
  ]);

  const rulesById = new Map<string, (typeof primaryRules)[number]>();
  for (const rule of primaryRules) {
    if (!rule.archived && rule.enabled) rulesById.set(rule.id, rule);
  }
  for (const row of asPrereq) {
    const rule = row.rule;
    if (!rule || rule.archived || !rule.enabled) continue;
    rulesById.set(rule.id, rule);
  }

  const relatedCourseIds = new Set<string>();
  for (const rule of rulesById.values()) {
    relatedCourseIds.add(rule.courseId);
    for (const p of rule.prerequisites) relatedCourseIds.add(p.requiredCourseId);
  }

  const completionEntries = await Promise.all(
    [...relatedCourseIds].map(async (courseId) => {
      const complete = await isCourseComplete(userId, courseId);
      return [courseId, complete] as const;
    })
  );
  const completeByCourseId = new Map(completionEntries);

  for (const rule of rulesById.values()) {
    const memberIds = [
      rule.courseId,
      ...rule.prerequisites.map((p) => p.requiredCourseId),
    ];
    const uniqueMembers = [...new Set(memberIds)];
    const completedCourses = uniqueMembers.filter((id) =>
      completeByCourseId.get(id)
    ).length;

    const info: CourseCertificationInfo = {
      ruleId: rule.id,
      title: rule.title,
      badgeUrl: rule.badgeUrl,
      totalCourses: uniqueMembers.length,
      completedCourses,
    };

    for (const memberId of uniqueMembers) {
      if (!idSet.has(memberId)) continue;
      const list = result.get(memberId) ?? [];
      if (!list.some((c) => c.ruleId === info.ruleId)) {
        list.push(info);
        result.set(memberId, list);
      }
    }
  }

  return result;
}

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

  const certsByCourseId = await getCertificationInfoByCourseId(
    userId,
    visible.map((c) => c.id)
  );

  return Promise.all(
    visible.map(async (c) => {
      const itemCount = c._count.courseItems;
      let dto: Course;
      if (itemCount > 0) {
        const completed = await prisma.courseItemProgress.count({
          where: {
            userId,
            status: "COMPLETED",
            courseItem: { courseId: c.id, archived: false },
          },
        });
        dto = toCourseDTO(c as unknown as CourseWithRelations);
        dto = {
          ...dto,
          lessonCount: itemCount,
          progress: itemCount > 0 ? Math.round((completed / itemCount) * 100) : 0,
        };
      } else {
        dto = toCourseDTO(c as unknown as CourseWithRelations);
      }

      return {
        ...dto,
        certifications: certsByCourseId.get(c.id) ?? [],
      };
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
  const dto = toCourseDTO(course as unknown as CourseWithRelations);
  const certsByCourseId = await getCertificationInfoByCourseId(userId, [course.id]);
  return {
    ...dto,
    certifications: certsByCourseId.get(course.id) ?? [],
  };
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

export async function listCoursesAdmin(
  archived = false,
  createdById?: string,
) {
  return prisma.course.findMany({
    where: {
      archived,
      ...(createdById ? { createdById } : {}),
    },
    orderBy: archived ? { archivedAt: "desc" } : { title: "asc" },
    include: {
      modules: { include: { _count: { select: { lessons: true, courseItems: true } } } },
    },
  });
}
