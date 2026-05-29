import type { AiSourceAsset } from "@prisma/client";
import type { BlueprintItem, CourseBlueprint } from "./blueprint-schema";
import { buildItemContentUserMessage } from "./build-prompt";
import type { GenerationChatMessage } from "./generation-thread";
import { AI_GENERATION_MODEL, requireOpenAI } from "./openai-client";
import {
  type BlueprintItemType,
  formatAllowedTypesForPrompt,
  getCourseStructureGuidance,
} from "./allowed-item-types";
import {
  buildItemValidationRetryMessage,
  MAX_ITEM_CONTENT_ATTEMPTS,
  validateGeneratedItemContent,
} from "./validate-item-content";

const itemContentJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["item"],
  properties: {
    item: {
      type: "object",
      additionalProperties: true,
      required: ["type", "title"],
      properties: {
        type: { type: "string" },
        title: { type: "string" },
        outline: { type: "string" },
        track: { type: "string" },
        lesson: { type: "object" },
        video: { type: "object" },
        exam: { type: "object" },
        scenario: { type: "object" },
        linkedSourceAssetRefs: { type: "array", items: { type: "string" } },
      },
    },
  },
} as const;

function buildInitialThread(options: {
  blueprint: CourseBlueprint;
  userPrompt: string;
  allowedItemTypes: BlueprintItemType[];
}): GenerationChatMessage[] {
  const { blueprint, userPrompt, allowedItemTypes } = options;
  return [
    {
      role: "system",
      content: `You are an instructional designer writing one section of a training course at a time.
Output JSON with a single "item" object. Maintain consistency with the approved course structure and prior items in the conversation.
Allowed item types for this course: ${formatAllowedTypesForPrompt(allowedItemTypes)}.
${getCourseStructureGuidance(allowedItemTypes, blueprint.mode)}
Author instructions: ${userPrompt || "(none)"}
Return valid JSON only. LESSON items need lesson.bodyHtml (HTML). EXAM/QUIZ items need exam.questions[]. VIDEO items need youtubeUrl, sourceAssetRef, or transcript.`,
    },
    {
      role: "user",
      content: `Approved course structure:\n${JSON.stringify(
        {
          course: blueprint.course,
          modules: blueprint.modules.map((m) => ({
            title: m.title,
            items: m.items.map((i) => ({
              type: i.type,
              title: i.title,
              outline: i.outline,
            })),
          })),
        },
        null,
        2,
      )}`,
    },
    {
      role: "assistant",
      content:
        "Understood. I will generate each item in sequence with full content while following the structure.",
    },
  ];
}

async function requestItemJson(
  thread: GenerationChatMessage[],
): Promise<{ raw: string; parsed: unknown }> {
  const openai = requireOpenAI();
  const completion = await openai.chat.completions.create({
    model: AI_GENERATION_MODEL,
    messages: thread.map((m) => ({ role: m.role, content: m.content })),
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "item_content",
        strict: false,
        schema: itemContentJsonSchema as Record<string, unknown>,
      },
    },
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("No response from AI.");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("AI returned invalid JSON.");
  }

  return { raw, parsed };
}

export type GenerateItemContentResult =
  | {
      ok: true;
      item: BlueprintItem;
      thread: GenerationChatMessage[];
      attempts: number;
    }
  | {
      ok: false;
      skipped: true;
      reason: string;
      thread: GenerationChatMessage[];
      attempts: number;
    };

export async function generateItemContent(options: {
  blueprint: CourseBlueprint;
  moduleIndex: number;
  itemIndex: number;
  assets: AiSourceAsset[];
  thread: GenerationChatMessage[];
  userPrompt: string;
  allowedItemTypes: BlueprintItemType[];
}): Promise<GenerateItemContentResult> {
  const { blueprint, moduleIndex, itemIndex, assets, userPrompt, allowedItemTypes } =
    options;

  const skeleton = blueprint.modules[moduleIndex]?.items[itemIndex];
  if (!skeleton) {
    return {
      ok: false,
      skipped: true,
      reason: "Item not found in blueprint.",
      thread: options.thread,
      attempts: 0,
    };
  }

  let thread =
    options.thread.length > 0
      ? [...options.thread]
      : buildInitialThread({ blueprint, userPrompt, allowedItemTypes });

  const assetIds = new Set(assets.map((a) => a.id));
  let lastIssues: string[] = [];

  for (let attempt = 1; attempt <= MAX_ITEM_CONTENT_ATTEMPTS; attempt++) {
    if (attempt === 1) {
      const userMessage = buildItemContentUserMessage({
        blueprint,
        moduleIndex,
        itemIndex,
        assets,
        allowedItemTypes,
      });
      thread.push({ role: "user", content: userMessage });
    }

    let raw: string;
    let parsed: unknown;
    try {
      ({ raw, parsed } = await requestItemJson(thread));
    } catch (e) {
      lastIssues = [e instanceof Error ? e.message : "Generation request failed."];
      if (attempt < MAX_ITEM_CONTENT_ATTEMPTS) {
        thread.push({
          role: "user",
          content: buildItemValidationRetryMessage(lastIssues),
        });
        continue;
      }
      break;
    }

    thread.push({ role: "assistant", content: raw });

    const itemPayload =
      parsed && typeof parsed === "object" && "item" in parsed
        ? (parsed as { item: unknown }).item
        : parsed;

    const validation = validateGeneratedItemContent(skeleton, itemPayload, {
      assetIds,
    });

    if (validation.ok) {
      return { ok: true, item: validation.item, thread, attempts: attempt };
    }

    lastIssues = validation.issues;
    if (attempt < MAX_ITEM_CONTENT_ATTEMPTS) {
      thread.push({
        role: "user",
        content: buildItemValidationRetryMessage(lastIssues),
      });
    }
  }

  return {
    ok: false,
    skipped: true,
    reason: lastIssues.join(" "),
    thread,
    attempts: MAX_ITEM_CONTENT_ATTEMPTS,
  };
}
