import type {
  Certification,
  Course,
  Exam,
  Lesson,
  Manual,
  VideoTraining,
} from "./types";
import type {
  CertificationStatus,
  LessonProgressStatus,
  LessonType,
} from "@prisma/client";

export function mapLessonType(type: LessonType): Lesson["type"] {
  const map = { VIDEO: "video", MANUAL: "manual", EXAM: "exam" } as const;
  return map[type];
}

export function mapProgressStatus(
  status: LessonProgressStatus,
): Lesson["status"] {
  const map = {
    NOT_STARTED: "not_started",
    IN_PROGRESS: "in_progress",
    COMPLETED: "completed",
  } as const;
  return map[status];
}

export function mapCertStatus(
  status: CertificationStatus,
): Certification["status"] {
  const map = {
    EARNED: "earned",
    IN_PROGRESS: "in_progress",
    EXPIRED: "expired",
  } as const;
  return map[status];
}

export type CourseWithRelations = {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  estimatedHours: number;
  requiredRoles: string[];
  modules: {
    lessons: {
      id: string;
      slug: string;
      title: string;
      type: LessonType;
      durationMinutes: number | null;
      progress: { status: LessonProgressStatus }[];
    }[];
  }[];
};

export function computeCourseProgress(
  lessons: { progress: { status: LessonProgressStatus }[] }[],
): number {
  if (lessons.length === 0) return 0;
  const completed = lessons.filter(
    (l) => l.progress[0]?.status === "COMPLETED",
  ).length;
  return Math.round((completed / lessons.length) * 100);
}

export function toCourseDTO(
  course: CourseWithRelations,
  progressPercent?: number,
): Course {
  const flatLessons = course.modules.flatMap((m) => m.lessons);
  const progress =
    progressPercent ?? computeCourseProgress(flatLessons);

  return {
    id: course.slug,
    title: course.title,
    description: course.description,
    category: course.category,
    progress,
    lessonCount: flatLessons.length,
    estimatedHours: course.estimatedHours,
    requiredForRole:
      course.requiredRoles.length > 0 ? course.requiredRoles : undefined,
    lessons: flatLessons.map((l) => ({
      id: l.slug,
      title: l.title,
      type: mapLessonType(l.type),
      durationMinutes: l.durationMinutes ?? undefined,
      status: mapProgressStatus(
        l.progress[0]?.status ?? "NOT_STARTED",
      ),
    })),
  };
}

export function toVideoTrainingDTO(v: {
  id: string;
  title: string;
  durationMinutes: number | null;
  courseSlug: string;
  courseTitle: string;
  watchedPercent: number;
}): VideoTraining {
  return {
    id: v.id,
    title: v.title,
    courseId: v.courseSlug,
    courseTitle: v.courseTitle,
    durationMinutes: v.durationMinutes ?? 0,
    watchedPercent: v.watchedPercent,
  };
}

export function toManualDTO(m: {
  id: string;
  title: string;
  category: string;
  version: string;
  updatedAt: Date;
  pageCount: number;
  blobUrl: string | null;
}): Manual & { blobUrl?: string } {
  return {
    id: m.id,
    title: m.title,
    category: m.category,
    version: m.version,
    updatedAt: m.updatedAt.toISOString().slice(0, 10),
    pageCount: m.pageCount,
    blobUrl: m.blobUrl ?? undefined,
  };
}

export function toExamDTO(e: {
  id: string;
  title: string;
  courseSlug: string;
  courseTitle: string;
  questionCount: number;
  passingScore: number;
  timeLimitMinutes: number;
  attemptsAllowed: number;
  status: Exam["status"];
}): Exam {
  return {
    id: e.id,
    title: e.title,
    courseId: e.courseSlug,
    courseTitle: e.courseTitle,
    questionCount: e.questionCount,
    passingScore: e.passingScore,
    timeLimitMinutes: e.timeLimitMinutes,
    attemptsAllowed: e.attemptsAllowed,
    status: e.status,
  };
}

export function toCertificationDTO(c: {
  id: string;
  title: string;
  courseSlug: string;
  status: CertificationStatus;
  issuedAt: Date | null;
  expiresAt: Date | null;
  description?: string | null;
  badgeUrl?: string | null;
  pdfUrl?: string | null;
}): Certification {
  return {
    id: c.id,
    title: c.title,
    courseId: c.courseSlug,
    description: c.description ?? null,
    badgeUrl: c.badgeUrl ?? null,
    pdfUrl: c.pdfUrl ?? null,
    status: mapCertStatus(c.status),
    issuedAt: c.issuedAt?.toISOString().slice(0, 10),
    expiresAt: c.expiresAt?.toISOString().slice(0, 10),
  };
}
