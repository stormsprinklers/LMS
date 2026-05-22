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
  status: "available" | "passed" | "failed" | "locked";
}

export interface Certification {
  id: string;
  title: string;
  courseId: string;
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
