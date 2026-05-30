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
import { LESSON_HTML_AUTHORING_GUIDE } from "./lesson-html";
import {
  EXAM_AI_QUESTION_MAX,
  EXAM_AI_QUESTION_MIN,
  QUIZ_AI_QUESTION_COUNT,
} from "./exam-question-counts";
import { generateCourseAssessmentQuestions } from "./generate-course-assessment";
import {
  buildMediaInstructionsForItem,
  collectUsedVisualMediaIds,
  MEDIA_USAGE_GUIDE,
  pickVisualMediaForItem,
} from "./media-asset-usage";
import { discoverYoutubeVideoForItem } from "./discover-youtube-video";
import { compactItemSummary, repairGeneratedItemCandidate } from "./repair-item-content";
import type { ItemContentValidationContext } from "./repair-item-content";
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
  discoverYoutubeVideos?: boolean;
  discoverImages?: boolean;
}): GenerationChatMessage[] {
  const {
    blueprint,
    userPrompt,
    allowedItemTypes,
    assetIds,
    discoverYoutubeVideos,
    discoverImages,
  } = options;
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
${getCourseStructureGuidance(allowedItemTypes, blueprint.mode, { discoverYoutubeVideos, discoverImages })}
${assetIdList}
${LESSON_HTML_AUTHORING_GUIDE}
${MEDIA_USAGE_GUIDE}
Author instructions: ${userPrompt || "(none)"}
Return valid JSON only. LESSON items need lesson.bodyHtml with <h2> titles and <p> paragraphs (title/paragraph format), at most one short <ul> list, plus at most one storm-media marker only when assigned to this item. Each photo/video upload may appear once in the entire course. QUIZ items need exactly ${QUIZ_AI_QUESTION_COUNT} questions in exam.questions[]. EXAM items need ${EXAM_AI_QUESTION_MIN}–${EXAM_AI_QUESTION_MAX} questions in exam.questions[]. Each question needs options with isCorrect on at least one option. VIDEO: use youtubeUrl OR sourceAssetRef from the valid id list OR transcript.`,
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

async function generateAssessmentItemContent(options: {
  skeleton: BlueprintItem;
  blueprint: CourseBlueprint;
  moduleIndex: number;
  itemIndex: number;
  userPrompt: string;
  persistedThread: GenerationChatMessage[];
  userMessage: string;
  itemContentCtx: ItemContentValidationContext;
  totalAttemptsStart: number;
}): Promise<GenerateItemContentResult> {
  const {
    skeleton,
    blueprint,
    moduleIndex,
    itemIndex,
    userPrompt,
    persistedThread,
    userMessage,
    itemContentCtx,
    totalAttemptsStart,
  } = options;

  const itemType = skeleton.type as "QUIZ" | "EXAM";
  let lastError = "";

  for (let attempt = 1; attempt <= MAX_VALIDATION_ATTEMPTS; attempt++) {
    const generated = await generateCourseAssessmentQuestions({
      itemType,
      blueprint,
      moduleIndex,
      itemIndex,
      userPrompt,
    });

    if (!generated.ok) {
      lastError = generated.error;
      continue;
    }

    const repaired = repairGeneratedItemCandidate(
      skeleton,
      {
        exam: {
          questions: generated.questions,
        },
      },
      { assetIds: itemContentCtx.assetIds },
    );

    const validation = validateGeneratedItemContent(skeleton, repaired, itemContentCtx);

    if (validation.ok) {
      const thread: GenerationChatMessage[] = [
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
        thread,
        attempts: totalAttemptsStart + attempt,
      };
    }

    lastError = validation.issues.join(" ");
  }

  return {
    ok: false,
    skipped: true,
    reason: lastError || "Could not generate assessment questions.",
    thread: persistedThread,
    attempts: totalAttemptsStart + MAX_VALIDATION_ATTEMPTS,
  };
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

async function generateDiscoveredVideoItem(options: {
  skeleton: BlueprintItem;
  blueprint: CourseBlueprint;
  moduleIndex: number;
  itemIndex: number;
  userPrompt: string;
  thread: GenerationChatMessage[];
  userMessage: string;
  itemContentCtx: ItemContentValidationContext;
}): Promise<GenerateItemContentResult> {
  const {
    skeleton,
    blueprint,
    moduleIndex,
    itemIndex,
    userPrompt,
    thread,
    userMessage,
    itemContentCtx,
  } = options;

  const mod = blueprint.modules[moduleIndex];
  if (!mod) {
    return {
      ok: false,
      skipped: true,
      reason: "Module not found.",
      thread,
      attempts: 0,
    };
  }

  const discovered = await discoverYoutubeVideoForItem({
    courseTitle: blueprint.course.title,
    moduleTitle: mod.title,
    itemTitle: skeleton.title,
    outline: skeleton.outline,
    userPrompt,
  });

  if (!discovered) {
    return {
      ok: false,
      skipped: true,
      reason:
        "Could not find a related YouTube video. Set GOOGLE_CLOUD_API_KEY (YouTube Data API) or paste a YouTube link manually.",
      thread,
      attempts: 1,
    };
  }

  const candidate = repairGeneratedItemCandidate(
    skeleton,
    {
      video: {
        youtubeUrl: discovered.url,
        includeRecording: false,
        transcript: discovered.transcript,
      },
    },
    itemContentCtx,
  );

  const validation = validateGeneratedItemContent(
    skeleton,
    candidate,
    itemContentCtx,
  );

  if (!validation.ok) {
    return {
      ok: false,
      skipped: true,
      reason: validation.issues.join(" ") || "Invalid video content.",
      thread,
      attempts: 1,
    };
  }

  return {
    ok: true,
    item: validation.item,
    thread: [
      ...thread,
      { role: "user", content: userMessage },
      {
        role: "assistant",
        content: compactItemSummary(validation.item),
      },
    ],
    attempts: 1,
  };
}

export async function generateItemContent(options: {
  blueprint: CourseBlueprint;
  moduleIndex: number;
  itemIndex: number;
  assets: AiSourceAsset[];
  thread: GenerationChatMessage[];
  userPrompt: string;
  allowedItemTypes: BlueprintItemType[];
  discoverYoutubeVideos?: boolean;
  discoverImages?: boolean;
}): Promise<GenerateItemContentResult> {
  const {
    blueprint,
    moduleIndex,
    itemIndex,
    assets,
    userPrompt,
    allowedItemTypes,
    discoverYoutubeVideos,
    discoverImages,
  } = options;

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

  const usedMediaAssetIds = collectUsedVisualMediaIds(blueprint, {
    moduleIndex,
    itemIndex,
  });
  const assignedMediaAssetId = pickVisualMediaForItem(
    skeleton,
    assets,
    usedMediaAssetIds,
  );
  const itemContentCtx = {
    assetIds: assetIdSet,
    usedMediaAssetIds,
    assignedMediaAssetIds:
      assignedMediaAssetId ? [assignedMediaAssetId] : [],
  };

  let persistedThread =
    options.thread.length > 0
      ? [...options.thread]
      : buildInitialThread({
          blueprint,
          userPrompt,
          allowedItemTypes,
          assetIds,
          discoverYoutubeVideos,
          discoverImages,
        });

  const userMessage = buildItemContentUserMessage({
    blueprint,
    moduleIndex,
    itemIndex,
    assets,
    allowedItemTypes,
    usedMediaAssetIds,
    assignedMediaAssetId,
    discoverYoutubeVideos,
    discoverImages,
  });

  const hasUploadForVideo =
    !!assignedMediaAssetId ||
    (skeleton.linkedSourceAssetRefs ?? []).some((id) => assetIdSet.has(id));

  if (
    skeleton.type === "VIDEO" &&
    discoverYoutubeVideos &&
    !hasUploadForVideo
  ) {
    return generateDiscoveredVideoItem({
      skeleton,
      blueprint,
      moduleIndex,
      itemIndex,
      userPrompt,
      thread: persistedThread,
      userMessage,
      itemContentCtx,
    });
  }

  if (skeleton.type === "QUIZ" || skeleton.type === "EXAM") {
    return generateAssessmentItemContent({
      skeleton,
      blueprint,
      moduleIndex,
      itemIndex,
      userPrompt,
      persistedThread,
      userMessage,
      itemContentCtx,
      totalAttemptsStart: 0,
    });
  }

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
          itemContentCtx,
        );

        const validation = validateGeneratedItemContent(
          skeleton,
          repaired,
          itemContentCtx,
        );

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
    reason:
      lastIssues.length > 0 ?
        lastIssues.join(" ")
      : "Content generation failed after multiple attempts.",
    thread: persistedThread,
    attempts: totalAttempts,
  };
}
