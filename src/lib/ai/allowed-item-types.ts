import type { AiGenerationMode, CourseItemType } from "@prisma/client";
import type { CourseBlueprint, CourseStructure } from "./blueprint-schema";
import { itemTypeSchema } from "./blueprint-schema";
import type { z } from "zod";

export type BlueprintItemType = z.infer<typeof itemTypeSchema>;

export const ALL_BLUEPRINT_ITEM_TYPES: BlueprintItemType[] = [
  "LESSON",
  "VIDEO",
  "QUIZ",
  "EXAM",
  "SCENARIO",
  "SKILL_CHECK",
];

export const ITEM_TYPE_LABELS: Record<BlueprintItemType, string> = {
  LESSON: "Lessons",
  VIDEO: "Videos",
  QUIZ: "Quizzes",
  EXAM: "Exams",
  SCENARIO: "Scenarios",
  SKILL_CHECK: "Skill checks",
};

export const ITEM_TYPE_DESCRIPTIONS: Record<BlueprintItemType, string> = {
  LESSON: "Written training content (TipTap/HTML)",
  VIDEO: "Video items (uploads, YouTube, or transcript-based)",
  QUIZ: "Auto-graded quizzes (same engine as exams)",
  EXAM: "Auto-graded exams",
  SCENARIO: "Practice scenarios with prompts",
  SKILL_CHECK: "Trainer-evaluated field pass-off checklists",
};

export const DEFAULT_ALLOWED_ITEM_TYPES: BlueprintItemType[] = [
  "LESSON",
  "QUIZ",
  "EXAM",
  "VIDEO",
];

export function getCourseStructureGuidance(
  allowed: BlueprintItemType[],
  mode: AiGenerationMode,
): string {
  const lines: string[] = [
    "CURRICULUM STRUCTURE (preferred pattern — use only allowed types above):",
  ];

  if (allowed.includes("LESSON")) {
    lines.push("- Build modules primarily from LESSON items (step-by-step teaching).");
  }
  if (allowed.includes("QUIZ")) {
    lines.push(
      "- Add QUIZ items after lesson sections to check understanding before moving on.",
    );
  }
  if (allowed.includes("VIDEO")) {
    lines.push(
      "- Use VIDEO for demos or source recordings; pair with a nearby LESSON or QUIZ when possible.",
    );
  }
  if (allowed.includes("EXAM")) {
    lines.push(
      mode === "course"
        ? "- End each module with an EXAM. The last item in the final module should be the course capstone EXAM."
        : "- End the module with an EXAM as the final assessment.",
    );
  }
  if (allowed.includes("SCENARIO")) {
    lines.push("- Use SCENARIO sparingly for realistic practice, not as the main structure.");
  }
  if (allowed.includes("SKILL_CHECK")) {
    lines.push("- Use SKILL_CHECK only when field pass-off is essential.");
  }

  lines.push(
    "- Typical flow: LESSON → LESSON → QUIZ → … → EXAM. Avoid modules that are only videos or only quizzes.",
  );

  return lines.join("\n");
}

export function parseAllowedItemTypes(raw: unknown): BlueprintItemType[] {
  if (!Array.isArray(raw) || raw.length === 0) return [...DEFAULT_ALLOWED_ITEM_TYPES];
  const parsed: BlueprintItemType[] = [];
  for (const v of raw) {
    const r = itemTypeSchema.safeParse(v);
    if (r.success && !parsed.includes(r.data)) parsed.push(r.data);
  }
  return parsed.length > 0 ? parsed : [...DEFAULT_ALLOWED_ITEM_TYPES];
}

export function formatAllowedTypesForPrompt(allowed: BlueprintItemType[]): string {
  return allowed.map((t) => `${t} (${ITEM_TYPE_LABELS[t]})`).join(", ");
}

export function filterStructureByAllowedTypes(
  structure: CourseStructure,
  allowed: BlueprintItemType[],
): CourseStructure {
  return {
    ...structure,
    modules: structure.modules
      .map((mod) => ({
        ...mod,
        items: mod.items.filter((item) => allowed.includes(item.type)),
      }))
      .filter((mod) => mod.items.length > 0),
  };
}

export function filterBlueprintByAllowedTypes(
  blueprint: CourseBlueprint,
  allowed: BlueprintItemType[],
): CourseBlueprint {
  return {
    ...blueprint,
    modules: blueprint.modules
      .map((mod) => ({
        ...mod,
        items: mod.items.filter((item) => allowed.includes(item.type)),
      }))
      .filter((mod) => mod.items.length > 0),
  };
}

/** Prisma CourseItemType matches blueprint item types. */
export function toPrismaItemTypes(allowed: BlueprintItemType[]): CourseItemType[] {
  return allowed as CourseItemType[];
}
