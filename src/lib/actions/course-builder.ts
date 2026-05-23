"use server";

import { prisma } from "@/lib/db";
import { requireAdmin, requireManageCourse, requireManageCourseItem, requireManageModule, requireStaff } from "@/lib/auth-utils";
import { revalidatePath } from "next/cache";
import { validateCourseForPublish } from "@/lib/courses/validate-publish";
import type {
  ContentStatus,
  CourseDifficulty,
  CourseItemTrack,
  CourseItemType,
  CourseStatus,
  ModuleUnlockRule,
  Prisma,
} from "@prisma/client";

function revalidateCourse(courseId: string, slug?: string) {
  revalidatePath("/admin/courses");
  revalidatePath(`/admin/courses/${courseId}/builder`);
  if (slug) {
    revalidatePath(`/courses/${slug}`);
    revalidatePath(`/admin/courses/${slug}`);
  }
}

async function markUnpublished(courseId: string) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { status: true },
  });
  if (course?.status === "PUBLISHED") {
    await prisma.course.update({
      where: { id: courseId },
      data: { hasUnpublishedChanges: true },
    });
  }
}

export async function createCourseDraft(data: {
  title: string;
  slug?: string;
}) {
  const session = await requireStaff();
  const slug =
    data.slug?.trim() ||
    data.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

  const existing = await prisma.course.findUnique({ where: { slug } });
  const finalSlug = existing ? `${slug}-${Date.now()}` : slug;

  const course = await prisma.course.create({
    data: {
      slug: finalSlug,
      title: data.title.trim(),
      description: "",
      category: "Field Technician Training",
      estimatedHours: 1,
      estimatedMinutes: 60,
      status: "DRAFT",
      published: false,
      createdById: session.user.id,
      modules: {
        create: {
          title: "Module 1",
          sortOrder: 0,
          status: "DRAFT",
        },
      },
      settings: {
        create: {},
      },
    },
  });

  revalidatePath("/admin/courses");
  return { courseId: course.id, slug: course.slug };
}

export async function updateCourseInfo(
  courseId: string,
  data: {
    title: string;
    slug: string;
    shortDescription?: string;
    description: string;
    category: string;
    difficulty: CourseDifficulty;
    estimatedMinutes: number;
    thumbnailUrl?: string;
    tags?: string[];
    internalNotes?: string;
  },
) {
  await requireManageCourse(courseId);
  const course = await prisma.course.update({
    where: { id: courseId },
    data: {
      title: data.title.trim(),
      slug: data.slug.trim(),
      shortDescription: data.shortDescription ?? null,
      description: data.description,
      category: data.category,
      difficulty: data.difficulty,
      estimatedMinutes: data.estimatedMinutes,
      estimatedHours: data.estimatedMinutes / 60,
      thumbnailUrl: data.thumbnailUrl ?? null,
      tags: data.tags ?? [],
      internalNotes: data.internalNotes ?? null,
    },
  });
  await markUnpublished(courseId);
  revalidateCourse(courseId, course.slug);
  return { success: true };
}

export async function updateCourseSettings(
  courseId: string,
  data: {
    visibility?: "PRIVATE" | "UNLISTED" | "PUBLIC";
    enrollmentMode?: "MANUAL" | "AUTO" | "SELF_ENROLL";
    dueDateType?: "NONE" | "RELATIVE" | "FIXED";
    dueDaysAfterEnrollment?: number | null;
    requireAllLessons?: boolean;
    requireAllQuizzes?: boolean;
    requireAllSkillChecks?: boolean;
    finalExamRequired?: boolean;
    finalExamPassingScore?: number | null;
    issueCertificate?: boolean;
    notifyOnAssign?: boolean;
    notifyReminder?: boolean;
  },
) {
  await requireManageCourse(courseId);
  await prisma.courseSettings.upsert({
    where: { courseId },
    create: { courseId, ...data },
    update: data,
  });
  await markUnpublished(courseId);
  revalidateCourse(courseId);
  return { success: true };
}

export async function createModule(courseId: string, title: string) {
  await requireManageCourse(courseId);
  const count = await prisma.module.count({ where: { courseId } });
  const mod = await prisma.module.create({
    data: {
      courseId,
      title: title || `Module ${count + 1}`,
      sortOrder: count,
      status: "DRAFT",
      unlockRule: count === 0 ? "ALWAYS" : "PREVIOUS_MODULE_COMPLETE",
    },
  });
  await markUnpublished(courseId);
  revalidateCourse(courseId);
  return { moduleId: mod.id };
}

export async function updateModule(
  moduleId: string,
  data: {
    title: string;
    description?: string;
    estimatedMinutes?: number;
    isRequired: boolean;
    unlockRule: ModuleUnlockRule;
    status: ContentStatus;
  },
) {
  await requireManageModule(moduleId);
  const mod = await prisma.module.update({
    where: { id: moduleId },
    data,
  });
  await markUnpublished(mod.courseId);
  revalidateCourse(mod.courseId);
  return { success: true };
}

export async function deleteModule(moduleId: string) {
  await requireAdmin();
  const mod = await prisma.module.findUnique({ where: { id: moduleId } });
  if (!mod) return { error: "Not found" };
  await prisma.module.delete({ where: { id: moduleId } });
  await markUnpublished(mod.courseId);
  revalidateCourse(mod.courseId);
  return { success: true };
}

export async function reorderCurriculum(
  courseId: string,
  moduleOrder: string[],
  itemOrders: Record<string, string[]>,
) {
  await requireManageCourse(courseId);
  for (let i = 0; i < moduleOrder.length; i++) {
    await prisma.module.update({
      where: { id: moduleOrder[i] },
      data: { sortOrder: i },
    });
  }
  for (const [moduleId, ids] of Object.entries(itemOrders)) {
    for (let i = 0; i < ids.length; i++) {
      await prisma.courseItem.update({
        where: { id: ids[i] },
        data: { sortOrder: i, moduleId },
      });
    }
  }
  await markUnpublished(courseId);
  revalidateCourse(courseId);
  return { success: true };
}

export async function createCourseItem(
  moduleId: string,
  itemType: CourseItemType,
  title: string,
  track?: CourseItemTrack,
) {
  const session = await requireManageModule(moduleId);
  const mod = await prisma.module.findUnique({
    where: { id: moduleId },
    select: { courseId: true },
  });
  if (!mod) return { error: "Module not found" };

  const count = await prisma.courseItem.count({ where: { moduleId } });
  let lessonContentId: string | undefined;
  let videoLessonId: string | undefined;
  let examId: string | undefined;
  let skillCheckId: string | undefined;
  let scenarioId: string | undefined;
  let completionRule = "manual";

  if (itemType === "LESSON") {
    const lc = await prisma.lessonContent.create({ data: { completionRule: "viewed" } });
    lessonContentId = lc.id;
    completionRule = "viewed";
  } else if (itemType === "VIDEO") {
    const vl = await prisma.videoLesson.create({ data: {} });
    videoLessonId = vl.id;
    completionRule = "watch_percent";
  } else if (itemType === "EXAM" || itemType === "QUIZ") {
    const exam = await prisma.exam.create({
      data: {
        title: title || "New Exam",
        courseId: mod.courseId,
        passingScore: 80,
        timeLimitMinutes: 30,
        attemptsAllowed: 3,
        published: false,
        createdById: session.user.id,
      },
    });
    examId = exam.id;
    completionRule = "quiz_passed";
  } else if (itemType === "SKILL_CHECK") {
    const sc = await prisma.skillCheck.create({ data: {} });
    skillCheckId = sc.id;
    completionRule = "trainer_pass";
  } else if (itemType === "SCENARIO") {
    const sc = await prisma.scenario.create({
      data: { prompt: title || "New scenario" },
    });
    scenarioId = sc.id;
    completionRule = "viewed";
  }

  const defaultTrack: CourseItemTrack =
    track ??
    (itemType === "EXAM" || itemType === "QUIZ" || itemType === "SKILL_CHECK"
      ? "PROVE"
      : itemType === "SCENARIO"
        ? "PRACTICE"
        : "LEARN");

  const item = await prisma.courseItem.create({
    data: {
      courseId: mod.courseId,
      moduleId,
      itemType,
      title: title || ITEM_DEFAULT_TITLE[itemType],
      sortOrder: count,
      track: defaultTrack,
      completionRule,
      status: "DRAFT",
      lessonContentId,
      videoLessonId,
      examId,
      skillCheckId,
      scenarioId,
    },
  });

  await markUnpublished(mod.courseId);
  revalidateCourse(mod.courseId);
  return { itemId: item.id };
}

const ITEM_DEFAULT_TITLE: Record<CourseItemType, string> = {
  LESSON: "New Lesson",
  VIDEO: "New Video",
  QUIZ: "New Quiz",
  EXAM: "New Exam",
  SKILL_CHECK: "New Skill Check",
  SCENARIO: "New Scenario",
};

export async function updateCourseItem(
  itemId: string,
  data: {
    title?: string;
    isRequired?: boolean;
    estimatedMinutes?: number;
    completionRule?: string;
    status?: ContentStatus;
    track?: CourseItemTrack;
  },
) {
  await requireManageCourseItem(itemId);
  const item = await prisma.courseItem.update({
    where: { id: itemId },
    data,
  });
  await markUnpublished(item.courseId);
  revalidateCourse(item.courseId);
  return { success: true };
}

export async function updateLessonContent(
  itemId: string,
  data: {
    bodyJson?: unknown;
    bodyHtml?: string;
    completionRule?: string;
    minimumTimeSeconds?: number;
  },
) {
  await requireManageCourseItem(itemId);
  const item = await prisma.courseItem.findUnique({
    where: { id: itemId },
    include: { lessonContent: true },
  });
  if (!item?.lessonContentId) return { error: "Not a lesson item" };

  await prisma.lessonContent.update({
    where: { id: item.lessonContentId },
    data: {
      bodyJson: data.bodyJson as Prisma.InputJsonValue,
      bodyHtml: data.bodyHtml,
      completionRule: data.completionRule,
      minimumTimeSeconds: data.minimumTimeSeconds,
    },
  });
  await markUnpublished(item.courseId);
  revalidateCourse(item.courseId);
  return { success: true };
}

export async function updateVideoLessonContent(
  itemId: string,
  data: {
    videoUrl?: string;
    muxPlaybackId?: string;
    transcript?: string;
    requiredWatchPercent?: number;
    completionRule?: string;
    estimatedMinutes?: number;
  },
) {
  await requireManageCourseItem(itemId);
  const item = await prisma.courseItem.findUnique({
    where: { id: itemId },
    include: { videoLesson: true, legacyLesson: { include: { videoAsset: true } } },
  });
  if (!item) return { error: "Not found" };

  if (item.videoLessonId) {
    await prisma.videoLesson.update({
      where: { id: item.videoLessonId },
      data: {
        videoUrl: data.videoUrl,
        muxPlaybackId: data.muxPlaybackId,
        transcript: data.transcript,
        requiredWatchPercent: data.requiredWatchPercent,
        completionRule: data.completionRule,
      },
    });
  }
  if (item.legacyLesson?.videoAsset && data.muxPlaybackId) {
    await prisma.videoAsset.update({
      where: { id: item.legacyLesson.videoAsset.id },
      data: { muxPlaybackId: data.muxPlaybackId },
    });
  }
  if (data.estimatedMinutes != null) {
    await prisma.courseItem.update({
      where: { id: itemId },
      data: { estimatedMinutes: data.estimatedMinutes },
    });
  }
  await markUnpublished(item.courseId);
  revalidateCourse(item.courseId);
  return { success: true };
}

export async function updateSkillCheck(
  itemId: string,
  data: {
    traineeInstructions?: string;
    evaluatorInstructions?: string;
    passingRule?: "ALL_REQUIRED" | "MINIMUM_SCORE";
    minimumScore?: number;
    requiresEvaluator?: boolean;
    steps?: { id?: string; text: string; isRequired: boolean; points: number }[];
  },
) {
  await requireManageCourseItem(itemId);
  const item = await prisma.courseItem.findUnique({
    where: { id: itemId },
    select: { skillCheckId: true, courseId: true },
  });
  if (!item?.skillCheckId) return { error: "Not a skill check" };

  await prisma.skillCheck.update({
    where: { id: item.skillCheckId },
    data: {
      traineeInstructions: data.traineeInstructions,
      evaluatorInstructions: data.evaluatorInstructions,
      passingRule: data.passingRule,
      minimumScore: data.minimumScore,
      requiresEvaluator: data.requiresEvaluator,
    },
  });

  if (data.steps) {
    await prisma.skillCheckStep.deleteMany({ where: { skillCheckId: item.skillCheckId } });
    await prisma.skillCheckStep.createMany({
      data: data.steps.map((s, i) => ({
        skillCheckId: item.skillCheckId!,
        text: s.text,
        isRequired: s.isRequired,
        points: s.points,
        sortOrder: i,
      })),
    });
  }

  await markUnpublished(item.courseId);
  revalidateCourse(item.courseId);
  return { success: true };
}

export async function updateScenario(
  itemId: string,
  data: {
    prompt: string;
    backgroundInfo?: string;
    difficulty?: string;
    category?: string;
  },
) {
  await requireManageCourseItem(itemId);
  const item = await prisma.courseItem.findUnique({
    where: { id: itemId },
    select: { scenarioId: true, courseId: true },
  });
  if (!item?.scenarioId) return { error: "Not a scenario" };

  await prisma.scenario.update({
    where: { id: item.scenarioId },
    data,
  });
  await markUnpublished(item.courseId);
  revalidateCourse(item.courseId);
  return { success: true };
}

export async function duplicateCourseItem(itemId: string) {
  await requireManageCourseItem(itemId);
  const item = await prisma.courseItem.findUnique({
    where: { id: itemId },
    include: {
      lessonContent: true,
      videoLesson: true,
      skillCheck: { include: { steps: true } },
      scenario: true,
    },
  });
  if (!item) return { error: "Not found" };

  const count = await prisma.courseItem.count({ where: { moduleId: item.moduleId } });
  let lessonContentId: string | undefined;
  let videoLessonId: string | undefined;
  let skillCheckId: string | undefined;
  let scenarioId: string | undefined;

  if (item.lessonContent) {
    const lc = await prisma.lessonContent.create({
      data: {
        bodyJson: item.lessonContent.bodyJson ?? undefined,
        bodyHtml: item.lessonContent.bodyHtml,
        completionRule: item.lessonContent.completionRule,
        minimumTimeSeconds: item.lessonContent.minimumTimeSeconds,
      },
    });
    lessonContentId = lc.id;
  }
  if (item.videoLesson) {
    const vl = await prisma.videoLesson.create({
      data: {
        videoUrl: item.videoLesson.videoUrl,
        muxPlaybackId: item.videoLesson.muxPlaybackId,
        requiredWatchPercent: item.videoLesson.requiredWatchPercent,
        completionRule: item.videoLesson.completionRule,
      },
    });
    videoLessonId = vl.id;
  }
  if (item.skillCheck) {
    const sc = await prisma.skillCheck.create({
      data: {
        traineeInstructions: item.skillCheck.traineeInstructions,
        evaluatorInstructions: item.skillCheck.evaluatorInstructions,
        passingRule: item.skillCheck.passingRule,
        minimumScore: item.skillCheck.minimumScore,
        requiresEvaluator: item.skillCheck.requiresEvaluator,
        steps: {
          create: item.skillCheck.steps.map((s) => ({
            text: s.text,
            isRequired: s.isRequired,
            points: s.points,
            sortOrder: s.sortOrder,
          })),
        },
      },
    });
    skillCheckId = sc.id;
  }
  if (item.scenario) {
    const sc = await prisma.scenario.create({
      data: {
        prompt: item.scenario.prompt,
        backgroundInfo: item.scenario.backgroundInfo,
        difficulty: item.scenario.difficulty,
        category: item.scenario.category,
      },
    });
    scenarioId = sc.id;
  }

  const dup = await prisma.courseItem.create({
    data: {
      courseId: item.courseId,
      moduleId: item.moduleId,
      itemType: item.itemType,
      title: `${item.title} (copy)`,
      sortOrder: count,
      isRequired: item.isRequired,
      estimatedMinutes: item.estimatedMinutes,
      completionRule: item.completionRule,
      status: "DRAFT",
      track: item.track,
      lessonContentId,
      videoLessonId,
      examId: item.examId ? undefined : undefined,
      skillCheckId,
      scenarioId,
    },
  });

  await markUnpublished(item.courseId);
  revalidateCourse(item.courseId);
  return { itemId: dup.id };
}

export async function archiveCourseItem(itemId: string) {
  await requireAdmin();
  const item = await prisma.courseItem.update({
    where: { id: itemId },
    data: { archived: true, archivedAt: new Date() },
  });
  await markUnpublished(item.courseId);
  revalidateCourse(item.courseId);
  return { success: true };
}

export async function deleteCourseItem(itemId: string) {
  await requireAdmin();
  const item = await prisma.courseItem.findUnique({ where: { id: itemId } });
  if (!item) return { error: "Not found" };
  await prisma.courseItem.delete({ where: { id: itemId } });
  await markUnpublished(item.courseId);
  revalidateCourse(item.courseId);
  return { success: true };
}

export async function assignCourseToUsers(
  courseId: string,
  userIds: string[],
  dueDays?: number,
) {
  const session = await requireManageCourse(courseId);
  for (const userId of userIds) {
    await prisma.enrollment.upsert({
      where: { userId_courseId: { userId, courseId } },
      create: { userId, courseId },
      update: {},
    });
    await prisma.courseEnrollmentAssignment.create({
      data: {
        courseId,
        assignedById: session.user.id,
        assignToType: "USER",
        assignToId: userId,
        dueDateType: dueDays ? "RELATIVE" : "NONE",
        dueDays: dueDays ?? null,
      },
    });
    const settings = await prisma.courseSettings.findUnique({ where: { courseId } });
    if (settings?.notifyOnAssign) {
      const course = await prisma.course.findUnique({
        where: { id: courseId },
        select: { title: true, slug: true },
      });
      await prisma.notification.create({
        data: {
          userId,
          type: "GRADES_PUBLISHED",
          title: `Assigned: ${course?.title ?? "Course"}`,
          body: "You have been assigned a new training course.",
          link: `/courses/${course?.slug}`,
        },
      });
    }
  }
  revalidateCourse(courseId);
  return { success: true };
}

export async function assignCourseToRole(courseId: string, jobRole: string) {
  await requireManageCourse(courseId);
  const users = await prisma.user.findMany({
    where: { jobRole, status: "ACTIVE", archived: false },
  });
  return assignCourseToUsers(
    courseId,
    users.map((u) => u.id),
  );
}

export async function assignCourseToAll(courseId: string) {
  await requireManageCourse(courseId);
  const users = await prisma.user.findMany({
    where: { status: "ACTIVE", archived: false, role: "EMPLOYEE" },
  });
  return assignCourseToUsers(
    courseId,
    users.map((u) => u.id),
  );
}

export async function publishCourse(courseId: string) {
  await requireManageCourse(courseId);
  const validation = await validateCourseForPublish(courseId);
  if (!validation.ok) {
    return { error: "Fix validation errors before publishing.", issues: validation.issues };
  }

  const course = await prisma.course.update({
    where: { id: courseId },
    data: {
      status: "PUBLISHED",
      published: true,
      publishedAt: new Date(),
      hasUnpublishedChanges: false,
    },
  });

  await prisma.courseItem.updateMany({
    where: { courseId, status: "DRAFT" },
    data: { status: "PUBLISHED" },
  });

  revalidateCourse(courseId, course.slug);
  revalidatePath("/courses");
  return { success: true };
}

export async function saveCourseAsDraft(courseId: string) {
  await requireManageCourse(courseId);
  await prisma.course.update({
    where: { id: courseId },
    data: { status: "DRAFT", published: false },
  });
  revalidateCourse(courseId);
  return { success: true };
}

export async function getCourseValidation(courseId: string) {
  await requireManageCourse(courseId);
  return validateCourseForPublish(courseId);
}

export async function markSkillCheckComplete(
  skillCheckId: string,
  userId: string,
  passed: boolean,
  score?: number,
  notes?: string,
) {
  const item = await prisma.courseItem.findFirst({
    where: { skillCheckId },
  });
  if (!item) return { error: "Not found" };
  const session = await requireManageCourse(item.courseId);

  await prisma.skillCheckCompletion.upsert({
    where: { skillCheckId_userId: { skillCheckId, userId } },
    create: {
      skillCheckId,
      userId,
      passed,
      score,
      notes,
      evaluatedById: session.user.id,
    },
    update: { passed, score, notes, evaluatedById: session.user.id, completedAt: new Date() },
  });

  if (item && passed) {
    await prisma.courseItemProgress.upsert({
      where: { userId_courseItemId: { userId, courseItemId: item.id } },
      create: { userId, courseItemId: item.id, status: "COMPLETED" },
      update: { status: "COMPLETED" },
    });
  }

  if (item) revalidateCourse(item.courseId);
  return { success: true };
}
