import type {
  ContentStatus,
  CourseDifficulty,
  CourseItemTrack,
  CourseItemType,
  CourseStatus,
  ModuleUnlockRule,
} from "@prisma/client";

export type CourseBuilderCourse = {
  id: string;
  slug: string;
  title: string;
  shortDescription: string | null;
  description: string;
  category: string;
  difficulty: CourseDifficulty;
  estimatedMinutes: number | null;
  estimatedHours: number;
  thumbnailUrl: string | null;
  tags: string[];
  internalNotes: string | null;
  status: CourseStatus;
  hasUnpublishedChanges: boolean;
  published: boolean;
  publishedAt: Date | null;
  modules: CourseBuilderModule[];
  settings: CourseBuilderSettings | null;
};

export type CourseBuilderModule = {
  id: string;
  title: string;
  description: string | null;
  sortOrder: number;
  estimatedMinutes: number | null;
  isRequired: boolean;
  unlockRule: ModuleUnlockRule;
  status: ContentStatus;
  items: CourseBuilderItem[];
};

export type CourseBuilderItem = {
  id: string;
  courseId: string;
  moduleId: string;
  itemType: CourseItemType;
  title: string;
  sortOrder: number;
  isRequired: boolean;
  estimatedMinutes: number | null;
  completionRule: string;
  status: ContentStatus;
  track: CourseItemTrack;
  examId?: string | null;
  legacyLessonId?: string | null;
};

export type CourseBuilderSettings = {
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
};

export const ITEM_TYPE_LABELS: Record<CourseItemType, string> = {
  LESSON: "Lesson",
  VIDEO: "Video",
  QUIZ: "Quiz",
  EXAM: "Exam",
  SKILL_CHECK: "Skill Check",
  SCENARIO: "Scenario",
};

export const TRACK_LABELS: Record<CourseItemTrack, string> = {
  LEARN: "Learn",
  PRACTICE: "Practice",
  PROVE: "Prove",
};
