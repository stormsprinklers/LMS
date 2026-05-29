import { prisma } from "@/lib/db";
import { requireManageCourse } from "@/lib/auth-utils";
import type { CourseBlueprint, BlueprintItem } from "./blueprint-schema";
import { validateBlueprint } from "./validate-blueprint";
import { tiptapDocFromHtml, injectImageIntoHtml } from "./tiptap-from-html";
import {
  expandStormMediaInLessonHtml,
  normalizeLessonBodyHtml,
  type LessonMediaAsset,
} from "./lesson-html";
import type {
  ContentStatus,
  CourseItemTrack,
  CourseItemType,
  Prisma,
  QuestionType,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { syncCourseItemMediaToLibrary } from "@/lib/library/sync-from-course";

const ITEM_DEFAULT_TITLE: Record<CourseItemType, string> = {
  LESSON: "New Lesson",
  VIDEO: "New Video",
  QUIZ: "New Quiz",
  EXAM: "New Exam",
  SKILL_CHECK: "New Skill Check",
  SCENARIO: "New Scenario",
};

function defaultTrack(
  itemType: CourseItemType,
  track?: CourseItemTrack,
): CourseItemTrack {
  if (track) return track;
  if (itemType === "EXAM" || itemType === "QUIZ" || itemType === "SKILL_CHECK") {
    return "PROVE";
  }
  if (itemType === "SCENARIO") return "PRACTICE";
  return "LEARN";
}

function defaultCompletionRule(itemType: CourseItemType, rule?: string): string {
  if (rule) return rule;
  switch (itemType) {
    case "LESSON":
      return "viewed";
    case "VIDEO":
      return "watch_percent";
    case "EXAM":
    case "QUIZ":
      return "quiz_passed";
    case "SKILL_CHECK":
      return "trainer_pass";
    default:
      return "viewed";
  }
}

function resolveAssetUrl(
  blueprint: CourseBlueprint,
  assetRef?: string,
): string | undefined {
  if (!assetRef) return undefined;
  const asset = blueprint.sourceAssets?.find((a) => a.id === assetRef);
  return asset?.blobUrl;
}

function mapQuestionType(type: string): QuestionType {
  if (type === "MULTI_SELECT") return "MULTIPLE_SELECT";
  if (type === "TRUE_FALSE") return "MULTIPLE_CHOICE";
  return type as QuestionType;
}

function applyMediaToLessonHtml(
  bodyHtml: string,
  blueprint: CourseBlueprint,
  moduleIndex: number,
  itemIndex: number,
): string {
  const assets = (blueprint.sourceAssets ?? []) as LessonMediaAsset[];
  let html = normalizeLessonBodyHtml(bodyHtml);

  const placements =
    blueprint.mediaPlacements?.filter(
      (p) => p.moduleIndex === moduleIndex && (p.itemIndex ?? 0) === itemIndex,
    ) ?? [];
  for (const p of placements) {
    const url = resolveAssetUrl(blueprint, p.assetRef);
    if (url) {
      html = injectImageIntoHtml(html, url, p.caption ?? "Image", p.position);
    }
  }

  return expandStormMediaInLessonHtml(html, assets);
}

async function createItemFromBlueprint(
  courseId: string,
  moduleId: string,
  item: BlueprintItem,
  sortOrder: number,
  createdById: string,
  blueprint: CourseBlueprint,
  moduleIndex: number,
  itemIndex: number,
) {
  const itemType = item.type as CourseItemType;
  const track = defaultTrack(itemType, item.track as CourseItemTrack | undefined);
  const completionRule = defaultCompletionRule(itemType, item.completionRule);

  let lessonContentId: string | undefined;
  let videoLessonId: string | undefined;
  let examId: string | undefined;
  let skillCheckId: string | undefined;
  let scenarioId: string | undefined;

  if (itemType === "LESSON" && item.lesson) {
    const assets = (blueprint.sourceAssets ?? []) as LessonMediaAsset[];
    let bodyHtml = applyMediaToLessonHtml(
      item.lesson.bodyHtml,
      blueprint,
      moduleIndex,
      itemIndex,
    );
    const tiptapDoc = item.lesson.tiptapDoc ?? tiptapDocFromHtml(bodyHtml, assets);
    const lc = await prisma.lessonContent.create({
      data: {
        bodyJson: tiptapDoc as Prisma.InputJsonValue,
        bodyHtml,
        completionRule,
      },
    });
    lessonContentId = lc.id;
  } else if (itemType === "VIDEO") {
    const sourceAsset = item.video?.sourceAssetRef
      ? blueprint.sourceAssets?.find((a) => a.id === item.video?.sourceAssetRef)
      : undefined;
    const includeRecording = item.video?.includeRecording !== false;
    const vl = await prisma.videoLesson.create({
      data: {
        videoUrl: item.video?.youtubeUrl ?? null,
        muxPlaybackId:
          includeRecording && sourceAsset?.muxPlaybackId
            ? sourceAsset.muxPlaybackId
            : null,
        muxAssetId:
          includeRecording && sourceAsset?.muxAssetId ? sourceAsset.muxAssetId : null,
        transcript:
          item.video?.transcript ??
          sourceAsset?.transcript ??
          sourceAsset?.extractedText ??
          null,
        requiredWatchPercent: item.video?.requiredWatchPercent ?? 75,
        completionRule: "watch_percent",
        status:
          item.video?.youtubeUrl ||
          (includeRecording && sourceAsset?.muxPlaybackId)
            ? "ready"
            : "pending",
      },
    });
    videoLessonId = vl.id;
  } else if (itemType === "EXAM" || itemType === "QUIZ") {
    const exam = await prisma.exam.create({
      data: {
        title: item.title,
        courseId,
        passingScore: item.exam?.passingScore ?? 80,
        timeLimitMinutes: item.exam?.timeLimitMinutes ?? 30,
        attemptsAllowed: 3,
        published: false,
        createdById,
      },
    });
    examId = exam.id;
    const questions = item.exam?.questions ?? [];
    for (let qi = 0; qi < questions.length; qi++) {
      const q = questions[qi];
      await prisma.question.create({
        data: {
          examId: exam.id,
          type: mapQuestionType(q.type),
          text: q.text,
          sortOrder: qi,
          options:
            q.type === "TRUE_FALSE"
              ? {
                  create: [
                    { text: "True", isCorrect: q.options?.[0]?.isCorrect ?? false, sortOrder: 0 },
                    { text: "False", isCorrect: q.options?.[1]?.isCorrect ?? true, sortOrder: 1 },
                  ],
                }
              : q.options && q.options.length > 0
                ? {
                    create: q.options.map((o, oi) => ({
                      text: o.text,
                      isCorrect: o.isCorrect,
                      sortOrder: oi,
                    })),
                  }
                : undefined,
        },
      });
    }
  } else if (itemType === "SKILL_CHECK") {
    const sc = await prisma.skillCheck.create({ data: {} });
    skillCheckId = sc.id;
  } else if (itemType === "SCENARIO" && item.scenario) {
    const sc = await prisma.scenario.create({
      data: {
        prompt: item.scenario.prompt,
        backgroundInfo: item.scenario.backgroundInfo ?? null,
      },
    });
    scenarioId = sc.id;
  } else if (itemType === "LESSON") {
    const lc = await prisma.lessonContent.create({
      data: { completionRule: "viewed", bodyHtml: "<p></p>" },
    });
    lessonContentId = lc.id;
  }

  const courseItem = await prisma.courseItem.create({
    data: {
      courseId,
      moduleId,
      itemType,
      title: item.title || ITEM_DEFAULT_TITLE[itemType],
      sortOrder,
      track,
      completionRule,
      status: "DRAFT" as ContentStatus,
      isRequired: item.isRequired ?? true,
      estimatedMinutes: item.estimatedMinutes ?? null,
      lessonContentId,
      videoLessonId,
      examId,
      skillCheckId,
      scenarioId,
    },
  });

  return courseItem.id;
}

export async function importCourseBlueprint(
  courseId: string,
  blueprint: CourseBlueprint,
  options?: { targetModuleId?: string; replaceCourseMeta?: boolean },
) {
  const session = await requireManageCourse(courseId);
  const userId = session.user.id;
  const role = (session.user as { role?: string }).role;

  const validation = validateBlueprint(blueprint);
  if (!validation.ok) {
    return { error: "Blueprint has errors.", issues: validation.issues };
  }

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: { modules: { orderBy: { sortOrder: "asc" } } },
  });
  if (!course) return { error: "Course not found." };

  if (options?.replaceCourseMeta !== false && blueprint.mode === "course") {
    await prisma.course.update({
      where: { id: courseId },
      data: {
        title: blueprint.course.title,
        description: blueprint.course.description ?? course.description,
        shortDescription: blueprint.course.shortDescription ?? null,
        category: blueprint.course.category ?? course.category,
        estimatedMinutes: blueprint.course.estimatedMinutes ?? course.estimatedMinutes,
        estimatedHours: (blueprint.course.estimatedMinutes ?? 60) / 60,
      },
    });
  }

  if (blueprint.mode === "lesson" && options?.targetModuleId) {
    const mod = course.modules.find((m) => m.id === options.targetModuleId);
    if (!mod) return { error: "Target module not found." };
    const modBlueprint = blueprint.modules[0];
    const startOrder = await prisma.courseItem.count({
      where: { moduleId: mod.id },
    });
    for (let i = 0; i < (modBlueprint?.items.length ?? 0); i++) {
      const newItemId = await createItemFromBlueprint(
        courseId,
        mod.id,
        modBlueprint.items[i],
        startOrder + i,
        userId,
        blueprint,
        0,
        i,
      );
      void syncCourseItemMediaToLibrary({
        courseItemId: newItemId,
        userId,
        role,
      });
    }
  } else if (blueprint.mode === "module" && options?.targetModuleId) {
    const modBlueprint = blueprint.modules[0];
    if (modBlueprint) {
      await prisma.module.update({
        where: { id: options.targetModuleId },
        data: {
          title: modBlueprint.title,
          description: modBlueprint.description ?? null,
        },
      });
      const startOrder = await prisma.courseItem.count({
        where: { moduleId: options.targetModuleId },
      });
      for (let i = 0; i < modBlueprint.items.length; i++) {
        const newItemId = await createItemFromBlueprint(
          courseId,
          options.targetModuleId,
          modBlueprint.items[i],
          startOrder + i,
          userId,
          blueprint,
          0,
          i,
        );
        void syncCourseItemMediaToLibrary({
          courseItemId: newItemId,
          userId,
          role,
        });
      }
    }
  } else {
    const existingModuleCount = course.modules.length;
    for (let mi = 0; mi < blueprint.modules.length; mi++) {
      const modBp = blueprint.modules[mi];
      const mod = await prisma.module.create({
        data: {
          courseId,
          title: modBp.title,
          description: modBp.description ?? null,
          sortOrder: existingModuleCount + mi,
          status: "DRAFT",
          unlockRule: existingModuleCount + mi === 0 ? "ALWAYS" : "PREVIOUS_MODULE_COMPLETE",
        },
      });
      for (let ii = 0; ii < modBp.items.length; ii++) {
        const newItemId = await createItemFromBlueprint(
          courseId,
          mod.id,
          modBp.items[ii],
          ii,
          userId,
          blueprint,
          mi,
          ii,
        );
        void syncCourseItemMediaToLibrary({
          courseItemId: newItemId,
          userId,
          role,
        });
      }
    }
  }

  await prisma.course.update({
    where: { id: courseId },
    data: { hasUnpublishedChanges: true },
  });

  revalidatePath("/admin/courses");
  revalidatePath(`/admin/courses/${courseId}/builder`);

  return { success: true as const };
}
