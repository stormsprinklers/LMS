import {
  PrismaClient,
  LessonType,
  UserRole,
  UserStatus,
} from "@prisma/client";
import bcrypt from "bcryptjs";

export const DEFAULT_ADMIN_EMAIL = "admin@stormsprinklers.com";
export const DEFAULT_ADMIN_PASSWORD = "admin123!";

export async function bootstrapDatabase(prisma: PrismaClient) {
  const adminEmail = process.env.ADMIN_EMAIL ?? DEFAULT_ADMIN_EMAIL;
  const adminPassword =
    process.env.ADMIN_INITIAL_PASSWORD ?? DEFAULT_ADMIN_PASSWORD;

  const adminHash = await bcrypt.hash(adminPassword, 12);
  const demoHash = await bcrypt.hash("demo123!", 12);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      passwordHash: adminHash,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    },
    create: {
      email: adminEmail,
      name: "Admin User",
      passwordHash: adminHash,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      jobRole: "Administrator",
    },
  });

  const demo = await prisma.user.upsert({
    where: { email: "employee@stormsprinklers.com" },
    update: {},
    create: {
      email: "employee@stormsprinklers.com",
      name: "Demo Employee",
      passwordHash: demoHash,
      role: UserRole.EMPLOYEE,
      status: UserStatus.ACTIVE,
      jobRole: "Technician",
    },
  });

  const coursesData = [
    {
      slug: "irrigation-fundamentals",
      title: "Irrigation System Fundamentals",
      description:
        "Core concepts for installing, maintaining, and troubleshooting residential and commercial sprinkler systems.",
      category: "Field Operations",
      estimatedHours: 4,
      requiredRoles: ["Technician", "Installer"],
      modules: [
        {
          title: "Core content",
          lessons: [
            {
              slug: "l1",
              title: "System overview & components",
              type: "VIDEO" as LessonType,
              durationMinutes: 18,
              sortOrder: 0,
            },
            {
              slug: "l2",
              title: "Zone layout best practices",
              type: "MANUAL" as LessonType,
              sortOrder: 1,
            },
            {
              slug: "l3",
              title: "Backflow prevention",
              type: "VIDEO" as LessonType,
              durationMinutes: 22,
              sortOrder: 2,
            },
            {
              slug: "l4",
              title: "Fundamentals knowledge check",
              type: "EXAM" as LessonType,
              sortOrder: 3,
            },
          ],
        },
      ],
      progress: {
        demo: ["COMPLETED", "COMPLETED", "IN_PROGRESS", "NOT_STARTED"] as const,
      },
      exam: { passingScore: 80, timeLimitMinutes: 45, attemptsAllowed: 3 },
      certTitle: "Irrigation Technician — Level 1",
    },
    {
      slug: "safety-compliance",
      title: "Workplace Safety & Compliance",
      description:
        "OSHA-aligned safety procedures, PPE requirements, and incident reporting for field crews.",
      category: "Safety",
      estimatedHours: 2.5,
      requiredRoles: ["All Employees"],
      modules: [
        {
          title: "Safety training",
          lessons: [
            {
              slug: "s1",
              title: "Hazard identification",
              type: "VIDEO" as LessonType,
              durationMinutes: 15,
              sortOrder: 0,
            },
            {
              slug: "s2",
              title: "Safety manual (2025)",
              type: "MANUAL" as LessonType,
              sortOrder: 1,
            },
            {
              slug: "s3",
              title: "Annual safety exam",
              type: "EXAM" as LessonType,
              sortOrder: 2,
            },
          ],
        },
      ],
      progress: { demo: ["COMPLETED", "COMPLETED", "COMPLETED"] as const },
      exam: { passingScore: 85, timeLimitMinutes: 30, attemptsAllowed: 2 },
      certTitle: "Storm Sprinklers Safety Certified",
    },
    {
      slug: "customer-service",
      title: "Customer Service Excellence",
      description:
        "Communication standards, service recovery, and representing Storm Sprinklers on every job site.",
      category: "Professional Development",
      estimatedHours: 1.5,
      requiredRoles: [] as string[],
      modules: [
        {
          title: "Service skills",
          lessons: [
            {
              slug: "c1",
              title: "Brand voice & first impressions",
              type: "VIDEO" as LessonType,
              durationMinutes: 12,
              sortOrder: 0,
            },
            {
              slug: "c2",
              title: "Handling difficult conversations",
              type: "VIDEO" as LessonType,
              durationMinutes: 20,
              sortOrder: 1,
            },
          ],
        },
      ],
      progress: { demo: ["IN_PROGRESS", "NOT_STARTED"] as const },
      exam: { passingScore: 75, timeLimitMinutes: 25, attemptsAllowed: 3 },
      certTitle: "Customer Experience Specialist",
    },
  ];

  const manuals = [
    {
      title: "Storm Sprinklers Field Operations Manual",
      category: "Operations",
      version: "3.2",
      pageCount: 48,
    },
    {
      title: "Equipment Maintenance Guide",
      category: "Maintenance",
      version: "1.8",
      pageCount: 32,
    },
    {
      title: "Safety & Incident Reporting Handbook",
      category: "Safety",
      version: "2025.1",
      pageCount: 24,
    },
  ];

  for (const c of coursesData) {
    const existingCourse = await prisma.course.findUnique({
      where: { slug: c.slug },
    });
    if (existingCourse) continue;

    const course = await prisma.course.create({
      data: {
        slug: c.slug,
        title: c.title,
        description: c.description,
        category: c.category,
        estimatedHours: c.estimatedHours,
        requiredRoles: c.requiredRoles,
      },
    });

    await prisma.enrollment.upsert({
      where: { userId_courseId: { userId: demo.id, courseId: course.id } },
      update: {},
      create: { userId: demo.id, courseId: course.id },
    });

    const rule = await prisma.certificationRule.create({
      data: {
        courseId: course.id,
        title: c.certTitle,
        validityMonths: 12,
      },
    });

    for (const mod of c.modules) {
      const module = await prisma.module.create({
        data: { courseId: course.id, title: mod.title, sortOrder: 0 },
      });

      for (const [i, lesson] of mod.lessons.entries()) {
        const created = await prisma.lesson.create({
          data: {
            moduleId: module.id,
            slug: lesson.slug,
            title: lesson.title,
            type: lesson.type,
            sortOrder: lesson.sortOrder ?? i,
            durationMinutes:
              "durationMinutes" in lesson ? lesson.durationMinutes : null,
          },
        });

        const status = c.progress.demo[i] ?? "NOT_STARTED";
        await prisma.lessonProgress.upsert({
          where: { userId_lessonId: { userId: demo.id, lessonId: created.id } },
          update: { status },
          create: {
            userId: demo.id,
            lessonId: created.id,
            status,
            watchedSeconds:
              status === "COMPLETED" && lesson.type === "VIDEO"
                ? (lesson.durationMinutes ?? 10) * 60
                : status === "IN_PROGRESS" && lesson.type === "VIDEO"
                  ? Math.floor((lesson.durationMinutes ?? 10) * 60 * 0.5)
                  : 0,
          },
        });

        if (lesson.type === "VIDEO") {
          await prisma.videoAsset.create({
            data: { lessonId: created.id, status: "ready" },
          });
        }

        if (lesson.type === "MANUAL") {
          const manual =
            manuals.find((m) =>
              c.slug === "safety-compliance"
                ? m.title.includes("Safety")
                : m.title.includes("Field"),
            ) ?? manuals[0];
          await prisma.manualAsset.create({
            data: {
              lessonId: created.id,
              title: manual.title,
              category: manual.category,
              version: manual.version,
              pageCount: manual.pageCount,
            },
          });
        }

        if (lesson.type === "EXAM") {
          const exam = await prisma.exam.create({
            data: {
              lessonId: created.id,
              title: `${c.title} — Final Exam`,
              passingScore: c.exam.passingScore,
              timeLimitMinutes: c.exam.timeLimitMinutes,
              attemptsAllowed: c.exam.attemptsAllowed,
            },
          });

          const q1 = await prisma.question.create({
            data: {
              examId: exam.id,
              text: "What is the primary purpose of a backflow preventer?",
              sortOrder: 0,
            },
          });
          await prisma.answerOption.createMany({
            data: [
              {
                questionId: q1.id,
                text: "Increase water pressure",
                isCorrect: false,
                sortOrder: 0,
              },
              {
                questionId: q1.id,
                text: "Prevent contaminated water from entering the supply",
                isCorrect: true,
                sortOrder: 1,
              },
              {
                questionId: q1.id,
                text: "Filter debris from sprinklers",
                isCorrect: false,
                sortOrder: 2,
              },
              {
                questionId: q1.id,
                text: "Schedule watering times",
                isCorrect: false,
                sortOrder: 3,
              },
            ],
          });

          if (c.slug === "safety-compliance") {
            await prisma.examAttempt.create({
              data: {
                userId: demo.id,
                examId: exam.id,
                score: 90,
                passed: true,
                status: "PASSED",
                completedAt: new Date("2025-06-12"),
              },
            });
            await prisma.certification.create({
              data: {
                userId: demo.id,
                ruleId: rule.id,
                title: c.certTitle,
                status: "EARNED",
                issuedAt: new Date("2025-06-12"),
                expiresAt: new Date("2026-06-12"),
              },
            });
          }
        }
      }
    }
  }

  for (const m of manuals) {
    const exists = await prisma.manualAsset.findFirst({
      where: { title: m.title, lessonId: null },
    });
    if (!exists) {
      await prisma.manualAsset.create({
        data: {
          title: m.title,
          category: m.category,
          version: m.version,
          pageCount: m.pageCount,
        },
      });
    }
  }

  return { admin, adminEmail, adminPassword };
}
