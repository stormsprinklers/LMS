import type { CourseBlueprint, CourseStructure } from "./blueprint-schema";
import type { BlueprintItemType } from "./allowed-item-types";

export type BlueprintIssue = {
  level: "error" | "warning";
  message: string;
  path?: string;
};

export function validateStructureBlueprint(
  structure: CourseStructure,
  allowed: BlueprintItemType[] = ["LESSON", "QUIZ", "EXAM", "VIDEO"],
  options?: { videoAssetIds?: Set<string>; discoverYoutubeVideos?: boolean },
): {
  ok: boolean;
  issues: BlueprintIssue[];
} {
  const issues: BlueprintIssue[] = [];

  if (!structure.course.title.trim()) {
    issues.push({ level: "error", message: "Course title is required.", path: "course.title" });
  }
  if (structure.mode === "course" && structure.modules.length === 0) {
    issues.push({ level: "error", message: "Add at least one module.", path: "modules" });
  }

  structure.modules.forEach((mod, mi) => {
    mod.items.forEach((item, ii) => {
      if (item.type === "VIDEO" && !options?.discoverYoutubeVideos) {
        const linked = item.linkedSourceAssetRefs ?? [];
        const videoIds = options?.videoAssetIds ?? new Set<string>();
        if (videoIds.size === 0) {
          issues.push({
            level: "error",
            message: `Module "${mod.title}" includes VIDEO "${item.title}" but no video resource is in session sources.`,
            path: `modules[${mi}].items[${ii}]`,
          });
        } else if (!linked.some((id) => videoIds.has(id))) {
          issues.push({
            level: "error",
            message: `VIDEO "${item.title}" must reference a linked video source id from uploads.`,
            path: `modules[${mi}].items[${ii}].linkedSourceAssetRefs`,
          });
        }
      }
      if (!item.outline?.trim()) {
        issues.push({
          level: "warning",
          message: `Item "${item.title}" has no outline.`,
          path: `modules[${mi}].items[${ii}].outline`,
        });
      }
    });

    if (mod.items.length === 0) return;

    const hasLesson = mod.items.some((i) => i.type === "LESSON");
    const hasQuiz = mod.items.some((i) => i.type === "QUIZ");
    const lastType = mod.items[mod.items.length - 1]?.type;

    if (allowed.includes("LESSON") && !hasLesson && mod.items.length >= 2) {
      issues.push({
        level: "warning",
        message: `Module "${mod.title}" has no LESSON items. Prefer teaching with lessons before assessments.`,
        path: `modules[${mi}].items`,
      });
    }

    if (allowed.includes("QUIZ") && hasLesson && !hasQuiz && mod.items.length >= 3) {
      issues.push({
        level: "warning",
        message: `Module "${mod.title}" has lessons but no QUIZ checkpoints.`,
        path: `modules[${mi}].items`,
      });
    }

    if (allowed.includes("EXAM") && lastType !== "EXAM" && mod.items.length >= 2) {
      issues.push({
        level: "warning",
        message: `Module "${mod.title}" should end with an EXAM assessment.`,
        path: `modules[${mi}].items`,
      });
    }
  });

  if (
    (structure.mode === "course" || structure.mode === "module") &&
    allowed.includes("EXAM")
  ) {
    const lastMod = structure.modules[structure.modules.length - 1];
    const lastItem = lastMod?.items[lastMod.items.length - 1];
    if (lastItem && lastItem.type !== "EXAM") {
      issues.push({
        level: "warning",
        message: "Course structure should usually end with a capstone EXAM.",
        path: "modules",
      });
    }
  }

  return { ok: !issues.some((i) => i.level === "error"), issues };
}

export function validateBlueprint(
  blueprint: CourseBlueprint,
  options?: { structureOnly?: boolean },
): {
  ok: boolean;
  issues: BlueprintIssue[];
} {
  const issues: BlueprintIssue[] = [];

  if (!blueprint.course.title.trim()) {
    issues.push({ level: "error", message: "Course title is required.", path: "course.title" });
  }

  if (blueprint.mode === "course" && blueprint.modules.length === 0) {
    issues.push({ level: "error", message: "Add at least one module.", path: "modules" });
  }

  if (blueprint.mode === "module" && blueprint.modules.length !== 1) {
    issues.push({
      level: "warning",
      message: "Module mode should produce exactly one module.",
      path: "modules",
    });
  }

  if (blueprint.mode === "lesson") {
    const itemCount = blueprint.modules.reduce((n, m) => n + m.items.length, 0);
    if (itemCount === 0) {
      issues.push({ level: "error", message: "Lesson mode needs at least one item.", path: "modules" });
    }
    if (itemCount > 1) {
      issues.push({
        level: "warning",
        message: "Lesson mode typically has one item; extra items will still be imported.",
      });
    }
  }

  blueprint.modules.forEach((mod, mi) => {
    if (!mod.title.trim()) {
      issues.push({
        level: "error",
        message: `Module ${mi + 1} needs a title.`,
        path: `modules[${mi}].title`,
      });
    }
    if (mod.items.length === 0) {
      issues.push({
        level: "warning",
        message: `Module "${mod.title}" has no items.`,
        path: `modules[${mi}].items`,
      });
    }

    mod.items.forEach((item, ii) => {
      const path = `modules[${mi}].items[${ii}]`;
      if (item.type === "LESSON") {
        const hasOutline = !!item.outline?.trim();
        const hasBody = !!item.lesson?.bodyHtml?.trim();
        if (!hasBody && options?.structureOnly && hasOutline) {
          /* expected before content phase */
        } else if (!hasBody) {
          issues.push({
            level: "error",
            message: `Lesson "${item.title}" has no generated content.`,
            path: `${path}.lesson`,
          });
        }
      }
      if (item.type === "VIDEO") {
        const v = item.video;
        const hasSource =
          v?.sourceAssetRef ||
          v?.youtubeUrl?.trim() ||
          v?.transcript?.trim();
        if (!hasSource) {
          issues.push({
            level: "warning",
            message: `Video "${item.title}" has no URL, asset, or transcript.`,
            path: `${path}.video`,
          });
        }
      }
      if (item.type === "EXAM" || item.type === "QUIZ") {
        if (!item.exam?.questions?.length) {
          issues.push({
            level: options?.structureOnly ? "warning" : "error",
            message: `Exam "${item.title}" has no questions.`,
            path: `${path}.exam`,
          });
        }
      }
      if (item.type === "SCENARIO" && !item.scenario?.prompt?.trim()) {
        issues.push({
          level: "warning",
          message: `Scenario "${item.title}" has no prompt.`,
          path: `${path}.scenario`,
        });
      }
      if (item.type === "SKILL_CHECK") {
        issues.push({
          level: "warning",
          message: `Skill check "${item.title}" must be configured manually in the builder.`,
          path,
        });
      }
    });
  });

  return { ok: !issues.some((i) => i.level === "error"), issues };
}
