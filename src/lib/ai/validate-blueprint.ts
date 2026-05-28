import type { CourseBlueprint, CourseStructure } from "./blueprint-schema";

export type BlueprintIssue = {
  level: "error" | "warning";
  message: string;
  path?: string;
};

export function validateStructureBlueprint(structure: CourseStructure): {
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
      if (!item.outline?.trim()) {
        issues.push({
          level: "warning",
          message: `Item "${item.title}" has no outline.`,
          path: `modules[${mi}].items[${ii}].outline`,
        });
      }
    });
  });

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
            level: "warning",
            message: `Lesson "${item.title}" has empty content.`,
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
