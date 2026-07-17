export type ContentType = "video" | "manual" | "exam";

export type LessonStatus = "not_started" | "in_progress" | "completed";

export interface Lesson {
  id: string;
  title: string;
  type: ContentType;
  durationMinutes?: number;
  status: LessonStatus;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  category: string;
  progress: number;
  lessonCount: number;
  estimatedHours: number;
  lessons: Lesson[];
  requiredForRole?: string[];
  /** Certifications this course contributes to (primary or prerequisite). */
  certifications?: CourseCertificationInfo[];
}

export interface CourseCertificationInfo {
  ruleId: string;
  title: string;
  badgeUrl: string | null;
  /** Courses that must be completed for this certification (primary + prereqs). */
  totalCourses: number;
  /** How many of those courses the learner has completed. */
  completedCourses: number;
}

export interface Exam {
  id: string;
  title: string;
  courseId: string;
  courseTitle: string;
  questionCount: number;
  passingScore: number;
  timeLimitMinutes: number;
  attemptsAllowed: number;
  status: "available" | "passed" | "failed" | "locked" | "pending" | "in_progress";
}

export interface Certification {
  id: string;
  title: string;
  courseId: string;
  description?: string | null;
  badgeUrl?: string | null;
  pdfUrl?: string | null;
  issuedAt?: string;
  expiresAt?: string;
  status: "earned" | "in_progress" | "expired";
}

export interface Manual {
  id: string;
  title: string;
  category: string;
  version: string;
  updatedAt: string;
  pageCount: number;
  blobUrl?: string;
}

export interface VideoTraining {
  id: string;
  title: string;
  courseId: string;
  courseTitle: string;
  durationMinutes: number;
  thumbnail?: string;
  watchedPercent: number;
}
