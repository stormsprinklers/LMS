import type {
  Certification,
  Course,
  Exam,
  Manual,
  VideoTraining,
} from "./types";

export const courses: Course[] = [
  {
    id: "irrigation-fundamentals",
    title: "Irrigation System Fundamentals",
    description:
      "Core concepts for installing, maintaining, and troubleshooting residential and commercial sprinkler systems.",
    category: "Field Operations",
    progress: 65,
    lessonCount: 12,
    estimatedHours: 4,
    requiredForRole: ["Technician", "Installer"],
    lessons: [
      {
        id: "l1",
        title: "System overview & components",
        type: "video",
        durationMinutes: 18,
        status: "completed",
      },
      {
        id: "l2",
        title: "Zone layout best practices",
        type: "manual",
        status: "completed",
      },
      {
        id: "l3",
        title: "Backflow prevention",
        type: "video",
        durationMinutes: 22,
        status: "in_progress",
      },
      {
        id: "l4",
        title: "Fundamentals knowledge check",
        type: "exam",
        status: "not_started",
      },
    ],
  },
  {
    id: "safety-compliance",
    title: "Workplace Safety & Compliance",
    description:
      "OSHA-aligned safety procedures, PPE requirements, and incident reporting for field crews.",
    category: "Safety",
    progress: 100,
    lessonCount: 8,
    estimatedHours: 2.5,
    requiredForRole: ["All Employees"],
    lessons: [
      {
        id: "s1",
        title: "Hazard identification",
        type: "video",
        durationMinutes: 15,
        status: "completed",
      },
      {
        id: "s2",
        title: "Safety manual (2025)",
        type: "manual",
        status: "completed",
      },
      {
        id: "s3",
        title: "Annual safety exam",
        type: "exam",
        status: "completed",
      },
    ],
  },
  {
    id: "customer-service",
    title: "Customer Service Excellence",
    description:
      "Communication standards, service recovery, and representing Storm Sprinklers on every job site.",
    category: "Professional Development",
    progress: 20,
    lessonCount: 6,
    estimatedHours: 1.5,
    lessons: [
      {
        id: "c1",
        title: "Brand voice & first impressions",
        type: "video",
        durationMinutes: 12,
        status: "in_progress",
      },
      {
        id: "c2",
        title: "Handling difficult conversations",
        type: "video",
        durationMinutes: 20,
        status: "not_started",
      },
    ],
  },
];

export const videoTrainings: VideoTraining[] = [
  {
    id: "v1",
    title: "Controller programming walkthrough",
    courseId: "irrigation-fundamentals",
    courseTitle: "Irrigation System Fundamentals",
    durationMinutes: 24,
    watchedPercent: 80,
  },
  {
    id: "v2",
    title: "Winterization procedure",
    courseId: "irrigation-fundamentals",
    courseTitle: "Irrigation System Fundamentals",
    durationMinutes: 16,
    watchedPercent: 0,
  },
  {
    id: "v3",
    title: "PPE donning & inspection",
    courseId: "safety-compliance",
    courseTitle: "Workplace Safety & Compliance",
    durationMinutes: 10,
    watchedPercent: 100,
  },
];

export const manuals: Manual[] = [
  {
    id: "m1",
    title: "Storm Sprinklers Field Operations Manual",
    category: "Operations",
    version: "3.2",
    updatedAt: "2025-11-01",
    pageCount: 48,
  },
  {
    id: "m2",
    title: "Equipment Maintenance Guide",
    category: "Maintenance",
    version: "1.8",
    updatedAt: "2026-01-15",
    pageCount: 32,
  },
  {
    id: "m3",
    title: "Safety & Incident Reporting Handbook",
    category: "Safety",
    version: "2025.1",
    updatedAt: "2025-09-20",
    pageCount: 24,
  },
];

export const exams: Exam[] = [
  {
    id: "e1",
    title: "Irrigation Fundamentals — Final Exam",
    courseId: "irrigation-fundamentals",
    courseTitle: "Irrigation System Fundamentals",
    questionCount: 25,
    passingScore: 80,
    timeLimitMinutes: 45,
    attemptsAllowed: 3,
    status: "available",
  },
  {
    id: "e2",
    title: "Annual Safety Certification Exam",
    courseId: "safety-compliance",
    courseTitle: "Workplace Safety & Compliance",
    questionCount: 20,
    passingScore: 85,
    timeLimitMinutes: 30,
    attemptsAllowed: 2,
    status: "passed",
  },
  {
    id: "e3",
    title: "Customer Service Assessment",
    courseId: "customer-service",
    courseTitle: "Customer Service Excellence",
    questionCount: 15,
    passingScore: 75,
    timeLimitMinutes: 25,
    attemptsAllowed: 3,
    status: "locked",
  },
];

export const certifications: Certification[] = [
  {
    id: "cert1",
    title: "Storm Sprinklers Safety Certified",
    courseId: "safety-compliance",
    issuedAt: "2025-06-12",
    expiresAt: "2026-06-12",
    status: "earned",
  },
  {
    id: "cert2",
    title: "Irrigation Technician — Level 1",
    courseId: "irrigation-fundamentals",
    status: "in_progress",
  },
  {
    id: "cert3",
    title: "Customer Experience Specialist",
    courseId: "customer-service",
    status: "in_progress",
  },
];

export function getCourseById(id: string): Course | undefined {
  return courses.find((c) => c.id === id);
}
