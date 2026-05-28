import type { AiSourceAsset } from "@prisma/client";
import type { BlueprintItem, CourseBlueprint } from "./blueprint-schema";
import { blueprintItemSchema } from "./blueprint-schema";
import { buildItemContentUserMessage } from "./build-prompt";
import type { GenerationChatMessage } from "./generation-thread";
import { AI_GENERATION_MODEL, requireOpenAI } from "./openai-client";
import {
  type BlueprintItemType,
  formatAllowedTypesForPrompt,
} from "./allowed-item-types";

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

export async function generateItemContent(options: {
  blueprint: CourseBlueprint;
  moduleIndex: number;
  itemIndex: number;
  assets: AiSourceAsset[];
  thread: GenerationChatMessage[];
  userPrompt: string;
  allowedItemTypes: BlueprintItemType[];
}): Promise<{
  item: BlueprintItem;
  thread: GenerationChatMessage[];
}> {
  const openai = requireOpenAI();
  const { blueprint, moduleIndex, itemIndex, assets, userPrompt, allowedItemTypes } =
    options;

  let thread = [...options.thread];
  if (thread.length === 0) {
    thread = [
      {
        role: "system",
        content: `You are an instructional designer writing one section of a training course at a time.
Output JSON with a single "item" object. Maintain consistency with the approved course structure and prior items in the conversation.
Allowed item types for this course: ${formatAllowedTypesForPrompt(allowedItemTypes)}.
Author instructions: ${userPrompt || "(none)"}`,
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
        content: "Understood. I will generate each item in sequence with full content while following the structure.",
      },
    ];
  }

  const userMessage = buildItemContentUserMessage({
    blueprint,
    moduleIndex,
    itemIndex,
    assets,
    allowedItemTypes,
  });
  thread.push({ role: "user", content: userMessage });

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

  const parsed = JSON.parse(raw) as { item?: unknown };
  const merged = blueprintItemSchema.parse({
    ...blueprint.modules[moduleIndex]?.items[itemIndex],
    ...(parsed.item && typeof parsed.item === "object" ? parsed.item : {}),
  });

  thread.push({ role: "assistant", content: raw });

  return { item: merged, thread };
}
