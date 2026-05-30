import {
  buildReworkMessages,
  compactBlueprintForRework,
  mergeReworkedItem,
} from "./rework-prompt";
import type { CourseBlueprint } from "./blueprint-schema";
import { AI_GENERATION_MODEL, AI_ITEM_CONTENT_MAX_TOKENS, requireOpenAI } from "./openai-client";
import { createChatCompletionWithRetry } from "./openai-completions";
import { courseBlueprintSchema, normalizeLlmBlueprint } from "./blueprint-schema";
import { validateBlueprint } from "./validate-blueprint";
import { LESSON_HTML_AUTHORING_GUIDE } from "./lesson-html";
import { repairGeneratedItemCandidate } from "./repair-item-content";
import { validateGeneratedItemContent } from "./validate-item-content";
import { examQuestionCountPrompt } from "./exam-question-counts";

const itemReworkJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["item"],
  properties: {
    item: {
      type: "object",
      additionalProperties: true,
      required: ["type", "title"],
    },
  },
} as const;

const moduleReworkJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["module"],
  properties: {
    module: {
      type: "object",
      additionalProperties: true,
      required: ["title", "items"],
    },
  },
} as const;

async function reworkSingleItem(
  blueprint: CourseBlueprint,
  instruction: string,
  moduleIndex: number,
  itemIndex: number,
): Promise<{ blueprint?: CourseBlueprint; error?: string; issues?: ReturnType<typeof validateBlueprint>["issues"] }> {
  const mod = blueprint.modules[moduleIndex];
  const item = mod?.items[itemIndex];
  if (!item) return { error: "Item not found." };

  const openai = requireOpenAI();
  const userContent = [
    `Revise this one course item according to the instruction. Return JSON: { "item": { ...complete item... } }`,
    `Instruction: ${instruction}`,
    `Module: ${mod.title}`,
    `Current item:\n${JSON.stringify(item, null, 0)}`,
    item.type === "LESSON" ? LESSON_HTML_AUTHORING_GUIDE : "",
    item.type === "QUIZ" || item.type === "EXAM" ? examQuestionCountPrompt(item.type) : "",
    "Keep type and linkedSourceAssetRefs unless the instruction requires changes.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const completion = await createChatCompletionWithRetry(openai, {
    model: AI_GENERATION_MODEL,
    messages: [
      {
        role: "system",
        content:
          "You revise one item in a workplace training course. Output valid JSON with a single item object only.",
      },
      { role: "user", content: userContent },
    ],
    max_tokens: AI_ITEM_CONTENT_MAX_TOKENS,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "rework_item",
        strict: false,
        schema: itemReworkJsonSchema as Record<string, unknown>,
      },
    },
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) return { error: "No response from AI." };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { error: "AI returned invalid JSON." };
  }

  const itemPayload =
    parsed && typeof parsed === "object" && "item" in parsed
      ? (parsed as { item: unknown }).item
      : parsed;

  const repaired = repairGeneratedItemCandidate(
    item,
    itemPayload && typeof itemPayload === "object"
      ? (itemPayload as Record<string, unknown>)
      : {},
    {},
  );

  const validation = validateGeneratedItemContent(item, repaired, {});
  if (!validation.ok) {
    return { error: validation.issues.join(" ") };
  }

  const next = mergeReworkedItem(blueprint, moduleIndex, itemIndex, validation.item);
  const blueprintValidation = validateBlueprint(next);
  return { blueprint: next, issues: blueprintValidation.issues };
}

async function reworkSingleModule(
  blueprint: CourseBlueprint,
  instruction: string,
  moduleIndex: number,
): Promise<{ blueprint?: CourseBlueprint; error?: string; issues?: ReturnType<typeof validateBlueprint>["issues"] }> {
  const mod = blueprint.modules[moduleIndex];
  if (!mod) return { error: "Module not found." };

  const openai = requireOpenAI();
  const otherModules = blueprint.modules
    .filter((_, i) => i !== moduleIndex)
    .map((m) => ({ title: m.title, itemCount: m.items.length }));

  const userContent = [
    `Revise this one module according to the instruction. Return JSON: { "module": { "title", "description?", "items": [...] } }`,
    `Instruction: ${instruction}`,
    `Module to revise:\n${JSON.stringify(mod, null, 0)}`,
    otherModules.length > 0
      ? `Other modules (for context only — do not include in output):\n${JSON.stringify(otherModules, null, 0)}`
      : "",
    "Return only the revised module object with all of its items.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const completion = await createChatCompletionWithRetry(openai, {
    model: AI_GENERATION_MODEL,
    messages: [
      {
        role: "system",
        content:
          "You revise one module in a workplace training course. Output valid JSON with a single module object only.",
      },
      { role: "user", content: userContent },
    ],
    max_tokens: AI_ITEM_CONTENT_MAX_TOKENS,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "rework_module",
        strict: false,
        schema: moduleReworkJsonSchema as Record<string, unknown>,
      },
    },
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) return { error: "No response from AI." };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { error: "AI returned invalid JSON." };
  }

  const modulePayload =
    parsed && typeof parsed === "object" && "module" in parsed
      ? (parsed as { module: unknown }).module
      : parsed;

  if (!modulePayload || typeof modulePayload !== "object") {
    return { error: "AI returned an invalid module." };
  }

  const next = {
    ...blueprint,
    modules: blueprint.modules.map((m, mi) =>
      mi !== moduleIndex ? m : { ...m, ...(modulePayload as typeof m) },
    ),
  };

  const normalized = normalizeLlmBlueprint(next);
  const parsedBlueprint = courseBlueprintSchema.safeParse(normalized);
  if (!parsedBlueprint.success) {
    return { error: parsedBlueprint.error.message };
  }

  const validation = validateBlueprint(parsedBlueprint.data);
  return { blueprint: parsedBlueprint.data, issues: validation.issues };
}

/** Rework one item (preferred) or one module — never the full course in one call. */
export async function reworkBlueprintSection(
  blueprint: CourseBlueprint,
  instruction: string,
  moduleIndex?: number,
  itemIndex?: number,
): Promise<{ blueprint?: CourseBlueprint; error?: string; issues?: ReturnType<typeof validateBlueprint>["issues"] }> {
  if (moduleIndex !== undefined && itemIndex !== undefined) {
    return reworkSingleItem(blueprint, instruction, moduleIndex, itemIndex);
  }

  if (moduleIndex !== undefined) {
    return reworkSingleModule(blueprint, instruction, moduleIndex);
  }

  return {
    error:
      "Select a specific item in the preview structure (click a lesson, quiz, or video). Rework does not run on the whole course at once.",
  };
}
