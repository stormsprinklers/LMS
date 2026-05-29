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
import { compactItemSummary, repairGeneratedItemCandidate } from "./repair-item-content";
import {
  buildItemValidationRetryMessage,
  MAX_API_ATTEMPTS,
  MAX_VALIDATION_ATTEMPTS,
  validateGeneratedItemContent,
} from "./validate-item-content";

const ITEM_CONTENT_MAX_TOKENS = 12_000;

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
  assetIds: string[];
}): GenerationChatMessage[] {
  const { blueprint, userPrompt, allowedItemTypes, assetIds } = options;
  const assetIdList =
    assetIds.length > 0
      ? `Valid sourceAssetRef ids (copy exactly): ${assetIds.join(", ")}.`
      : "";

  return [
    {
      role: "system",
      content: `You are an instructional designer writing one section of a training course at a time.
Output JSON with a single "item" object. Maintain consistency with the approved course structure and prior item summaries in the conversation.
Allowed item types: ${formatAllowedTypesForPrompt(allowedItemTypes)}.
${getCourseStructureGuidance(allowedItemTypes, blueprint.mode)}
${assetIdList}
Author instructions: ${userPrompt || "(none)"}
Return valid JSON only. LESSON items need lesson.bodyHtml (HTML, substantive). EXAM/QUIZ need exam.questions[] with options and isCorrect on at least one option per question. VIDEO: use youtubeUrl OR sourceAssetRef from the valid id list OR transcript.`,
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
              linkedSourceAssetRefs: i.linkedSourceAssetRefs,
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
): Promise<{ raw: string; parsed: unknown; truncated: boolean }> {
  const openai = requireOpenAI();
  const completion = await openai.chat.completions.create({
    model: AI_GENERATION_MODEL,
    messages: thread.map((m) => ({ role: m.role, content: m.content })),
    max_tokens: ITEM_CONTENT_MAX_TOKENS,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "item_content",
        strict: false,
        schema: itemContentJsonSchema as Record<string, unknown>,
      },
    },
  });

  const choice = completion.choices[0];
  const raw = choice?.message?.content;
  if (!raw) throw new Error("No response from AI.");

  const truncated = choice?.finish_reason === "length";

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("AI returned invalid JSON.");
  }

  return { raw, parsed, truncated };
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

  const assetIds = assets.map((a) => a.id);
  const assetIdSet = new Set(assetIds);

  let persistedThread =
    options.thread.length > 0
      ? [...options.thread]
      : buildInitialThread({
          blueprint,
          userPrompt,
          allowedItemTypes,
          assetIds,
        });

  const userMessage = buildItemContentUserMessage({
    blueprint,
    moduleIndex,
    itemIndex,
    assets,
    allowedItemTypes,
  });

  let workingThread: GenerationChatMessage[] = [
    ...persistedThread,
    { role: "user", content: userMessage },
  ];

  let lastIssues: string[] = [];
  let totalAttempts = 0;

  for (
    let validationAttempt = 1;
    validationAttempt <= MAX_VALIDATION_ATTEMPTS;
    validationAttempt++
  ) {
    let validationFailed = false;

    for (let apiAttempt = 1; apiAttempt <= MAX_API_ATTEMPTS; apiAttempt++) {
      totalAttempts++;
      try {
        const { parsed, truncated } = await requestItemJson(workingThread);

        if (truncated) {
          lastIssues = [
            "Response was truncated. Use shorter HTML or fewer exam questions.",
          ];
          validationFailed = true;
          break;
        }

        const itemPayload =
          parsed && typeof parsed === "object" && "item" in parsed
            ? (parsed as { item: unknown }).item
            : parsed;

        const repaired = repairGeneratedItemCandidate(
          skeleton,
          itemPayload && typeof itemPayload === "object"
            ? (itemPayload as Record<string, unknown>)
            : {},
          { assetIds: assetIdSet },
        );

        const validation = validateGeneratedItemContent(skeleton, repaired, {
          assetIds: assetIdSet,
        });

        if (validation.ok) {
          persistedThread = [
            ...persistedThread,
            { role: "user", content: userMessage },
            {
              role: "assistant",
              content: compactItemSummary(validation.item),
            },
          ];
          return {
            ok: true,
            item: validation.item,
            thread: persistedThread,
            attempts: totalAttempts,
          };
        }

        lastIssues = validation.issues;
        validationFailed = true;
        break;
      } catch (e) {
        lastIssues = [
          e instanceof Error ? e.message : "Generation request failed.",
        ];
        if (apiAttempt < MAX_API_ATTEMPTS) {
          continue;
        }
        validationFailed = true;
        break;
      }
    }

    if (validationAttempt < MAX_VALIDATION_ATTEMPTS && validationFailed) {
      workingThread = [
        ...workingThread,
        {
          role: "user",
          content: buildItemValidationRetryMessage(lastIssues),
        },
      ];
    }
  }

  return {
    ok: false,
    skipped: true,
    reason: lastIssues.join(" "),
    thread: persistedThread,
    attempts: totalAttempts,
  };
}
