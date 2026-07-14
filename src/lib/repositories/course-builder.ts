import { prisma } from "@/lib/db";
import type { CourseBuilderCourse } from "@/lib/course-builder/types";

const courseInclude = {
  settings: true,
  modules: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      courseItems: {
        where: { archived: false },
        orderBy: { sortOrder: "asc" as const },
        select: {
          id: true,
          courseId: true,
          moduleId: true,
          itemType: true,
          title: true,
          sortOrder: true,
          isRequired: true,
          estimatedMinutes: true,
          completionRule: true,
          status: true,
          track: true,
          examId: true,
          legacyLessonId: true,
          exam: {
            select: {
              id: true,
              title: true,
              published: true,
              _count: { select: { questions: true } },
            },
          },
        },
      },
    },
  },
};

type RawCourse = {
  id: string;
  slug: string;
  title: string;
  shortDescription: string | null;
  description: string;
  category: string;
  difficulty: CourseBuilderCourse["difficulty"];
  estimatedMinutes: number | null;
  estimatedHours: number;
  thumbnailUrl: string | null;
  tags: string[];
  internalNotes: string | null;
  status: CourseBuilderCourse["status"];
  hasUnpublishedChanges: boolean;
  published: boolean;
  publishedAt: Date | null;
  settings: {
    visibility: string;
    enrollmentMode: string;
    dueDateType: string;
    dueDaysAfterEnrollment: number | null;
    fixedDueDate: Date | null;
    requireAllLessons: boolean;
    requireAllQuizzes: boolean;
    requireAllSkillChecks: boolean;
    finalExamRequired: boolean;
    finalExamPassingScore: number | null;
    issueCertificate: boolean;
    notifyOnAssign: boolean;
    notifyReminder: boolean;
  } | null;
  modules: {
    id: string;
    title: string;
    description: string | null;
    sortOrder: number;
    estimatedMinutes: number | null;
    isRequired: boolean;
    unlockRule: CourseBuilderCourse["modules"][0]["unlockRule"];
    status: CourseBuilderCourse["modules"][0]["status"];
    courseItems: CourseBuilderCourse["modules"][0]["items"];
  }[];
};

function mapCourse(c: RawCourse): CourseBuilderCourse {
  return {
    id: c.id,
    slug: c.slug,
    title: c.title,
    shortDescription: c.shortDescription,
    description: c.description,
    category: c.category,
    difficulty: c.difficulty,
    estimatedMinutes: c.estimatedMinutes,
    estimatedHours: c.estimatedHours,
    thumbnailUrl: c.thumbnailUrl,
    tags: c.tags,
    internalNotes: c.internalNotes,
    status: c.status,
    hasUnpublishedChanges: c.hasUnpublishedChanges,
    published: c.published,
    publishedAt: c.publishedAt,
    settings: c.settings
      ? {
          visibility: c.settings.visibility,
          enrollmentMode: c.settings.enrollmentMode,
          dueDateType: c.settings.dueDateType,
          dueDaysAfterEnrollment: c.settings.dueDaysAfterEnrollment,
          fixedDueDate: c.settings.fixedDueDate,
          requireAllLessons: c.settings.requireAllLessons,
          requireAllQuizzes: c.settings.requireAllQuizzes,
          requireAllSkillChecks: c.settings.requireAllSkillChecks,
          finalExamRequired: c.settings.finalExamRequired,
          finalExamPassingScore: c.settings.finalExamPassingScore,
          issueCertificate: c.settings.issueCertificate,
          notifyOnAssign: c.settings.notifyOnAssign,
          notifyReminder: c.settings.notifyReminder,
        }
      : null,
    modules: c.modules.map((m) => ({
      id: m.id,
      title: m.title,
      description: m.description,
      sortOrder: m.sortOrder,
      estimatedMinutes: m.estimatedMinutes,
      isRequired: m.isRequired,
      unlockRule: m.unlockRule,
      status: m.status,
      items: m.courseItems,
    })),
  };
}

export async function getCourseForBuilder(courseId: string) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: courseInclude,
  });
  if (!course) return null;
  return mapCourse(course as RawCourse);
}

export async function getCourseForBuilderBySlug(slug: string) {
  const course = await prisma.course.findUnique({
    where: { slug },
    include: courseInclude,
  });
  if (!course) return null;
  return mapCourse(course as RawCourse);
}

export async function getCourseItemDetail(itemId: string) {
  return prisma.courseItem.findUnique({
    where: { id: itemId },
    include: {
      lessonContent: true,
      videoLesson: true,
      exam: {
        include: {
          questions: { include: { options: true }, orderBy: { sortOrder: "asc" } },
          _count: { select: { questions: true } },
        },
      },
      skillCheck: { include: { steps: { orderBy: { sortOrder: "asc" } } } },
      scenario: true,
      legacyLesson: { include: { videoAsset: true } },
    },
  });
}

export async function listUsersForAssignment() {
  return prisma.user.findMany({
    where: { status: "ACTIVE", archived: false },
    select: { id: true, email: true, name: true, jobRole: true },
    orderBy: { email: "asc" },
  });
}
