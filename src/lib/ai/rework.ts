import {
  buildReworkMessages,
  compactBlueprintForRework,
  mergeReworkedItem,
} from "./rework-prompt";
import type { CourseBlueprint } from "./blueprint-schema";
import { AI_GENERATION_MODEL, AI_ITEM_CONTENT_MAX_TOKENS, requireOpenAI } from "./openai-client";
import { AI_STRUCTURE_MAX_TOKENS } from "./openai-client";
import { createChatCompletionWithRetry } from "./openai-completions";
import { courseBlueprintSchema, normalizeLlmBlueprint, courseBlueprintJsonSchema } from "./blueprint-schema";
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

export async function reworkBlueprintSection(
  blueprint: CourseBlueprint,
  instruction: string,
  moduleIndex?: number,
  itemIndex?: number,
): Promise<{ blueprint?: CourseBlueprint; error?: string; issues?: ReturnType<typeof validateBlueprint>["issues"] }> {
  if (moduleIndex !== undefined && itemIndex !== undefined) {
    return reworkSingleItem(blueprint, instruction, moduleIndex, itemIndex);
  }

  const openai = requireOpenAI();
  const compact = compactBlueprintForRework(
    blueprint,
    moduleIndex !== undefined ? { moduleIndex } : undefined,
  );
  const { system, user } = buildReworkMessages(compact, instruction, moduleIndex, itemIndex);

  const completion = await createChatCompletionWithRetry(openai, {
    model: AI_GENERATION_MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    max_tokens: AI_STRUCTURE_MAX_TOKENS,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "course_blueprint",
        strict: false,
        schema: courseBlueprintJsonSchema as Record<string, unknown>,
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

  const normalized = normalizeLlmBlueprint(parsed);
  const next = courseBlueprintSchema.safeParse(normalized);
  if (!next.success) {
    return { error: next.error.message };
  }

  const validation = validateBlueprint(next.data);
  return { blueprint: next.data, issues: validation.issues };
}
