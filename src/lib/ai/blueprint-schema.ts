import { z } from "zod";

export const BLUEPRINT_VERSION = "1.0" as const;

export const blueprintModeSchema = z.enum(["course", "module", "lesson"]);
export const sourceAssetKindSchema = z.enum([
  "pdf",
  "pptx",
  "text",
  "audio",
  "video",
  "image",
  "embed",
]);
export const itemTypeSchema = z.enum([
  "LESSON",
  "VIDEO",
  "QUIZ",
  "EXAM",
  "SCENARIO",
  "SKILL_CHECK",
]);
export const trackSchema = z.enum(["LEARN", "PRACTICE", "PROVE"]);
export const placementPositionSchema = z.enum([
  "intro",
  "after_section",
  "inline",
  "item_end",
]);

export const sourceAssetSchema = z.object({
  id: z.string(),
  kind: sourceAssetKindSchema,
  filename: z.string().optional(),
  blobUrl: z.string().optional(),
  transcript: z.string().optional(),
  extractedText: z.string().optional(),
  summary: z.string().optional(),
  placementHint: z.string().optional(),
  includeRecording: z.boolean().optional(),
  suggestedModuleIndex: z.number().int().optional(),
  suggestedItemIndex: z.number().int().optional(),
  muxAssetId: z.string().optional(),
  muxPlaybackId: z.string().optional(),
});

export const mediaPlacementSchema = z.object({
  assetRef: z.string(),
  moduleIndex: z.number().int().nonnegative(),
  itemIndex: z.number().int().nonnegative().optional(),
  position: placementPositionSchema,
  sectionHint: z.string().optional(),
  caption: z.string().optional(),
});

export const lessonContentSchema = z.object({
  bodyHtml: z.string(),
  tiptapDoc: z.record(z.string(), z.unknown()).optional(),
});

export const videoContentSchema = z.object({
  sourceAssetRef: z.string().optional(),
  youtubeUrl: z.string().optional(),
  includeRecording: z.boolean().default(true),
  requiredWatchPercent: z.number().int().min(1).max(100).optional(),
  transcript: z.string().optional(),
});

export const examOptionSchema = z.object({
  text: z.string(),
  isCorrect: z.boolean(),
});

export const examQuestionSchema = z.object({
  text: z.string(),
  type: z.enum(["MULTIPLE_CHOICE", "MULTI_SELECT", "TRUE_FALSE", "FREE_RESPONSE"]),
  points: z.number().int().positive().optional(),
  options: z.array(examOptionSchema).optional(),
});

export const examContentSchema = z.object({
  passingScore: z.number().int().min(0).max(100).optional(),
  timeLimitMinutes: z.number().int().positive().optional(),
  questions: z.array(examQuestionSchema).min(1),
});

export const scenarioContentSchema = z.object({
  prompt: z.string(),
  backgroundInfo: z.string().optional(),
});

export const blueprintItemSchema = z.object({
  type: itemTypeSchema,
  title: z.string().min(1),
  track: trackSchema.optional(),
  isRequired: z.boolean().optional(),
  estimatedMinutes: z.number().int().positive().optional(),
  completionRule: z.string().optional(),
  lesson: lessonContentSchema.optional(),
  video: videoContentSchema.optional(),
  exam: examContentSchema.optional(),
  scenario: scenarioContentSchema.optional(),
});

export const blueprintModuleSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
  items: z.array(blueprintItemSchema).default([]),
});

export const courseBlueprintSchema = z.object({
  version: z.literal(BLUEPRINT_VERSION),
  mode: blueprintModeSchema,
  course: z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    shortDescription: z.string().optional(),
    category: z.string().optional(),
    estimatedMinutes: z.number().int().positive().optional(),
    learningObjectives: z.array(z.string()).optional(),
  }),
  modules: z.array(blueprintModuleSchema).default([]),
  sourceAssets: z.array(sourceAssetSchema).optional(),
  mediaPlacements: z.array(mediaPlacementSchema).optional(),
});

export type CourseBlueprint = z.infer<typeof courseBlueprintSchema>;
export type BlueprintItem = z.infer<typeof blueprintItemSchema>;
export type BlueprintModule = z.infer<typeof blueprintModuleSchema>;
export type SourceAsset = z.infer<typeof sourceAssetSchema>;

/** JSON Schema for OpenAI structured outputs (subset). */
export const courseBlueprintJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["version", "mode", "course", "modules"],
  properties: {
    version: { type: "string", enum: [BLUEPRINT_VERSION] },
    mode: { type: "string", enum: ["course", "module", "lesson"] },
    course: {
      type: "object",
      additionalProperties: false,
      required: ["title"],
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        shortDescription: { type: "string" },
        category: { type: "string" },
        estimatedMinutes: { type: "number" },
        learningObjectives: { type: "array", items: { type: "string" } },
      },
    },
    modules: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "items"],
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          sortOrder: { type: "number" },
          items: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["type", "title"],
              properties: {
                type: {
                  type: "string",
                  enum: ["LESSON", "VIDEO", "QUIZ", "EXAM", "SCENARIO", "SKILL_CHECK"],
                },
                title: { type: "string" },
                track: { type: "string", enum: ["LEARN", "PRACTICE", "PROVE"] },
                isRequired: { type: "boolean" },
                estimatedMinutes: { type: "number" },
                completionRule: { type: "string" },
                lesson: {
                  type: "object",
                  properties: {
                    bodyHtml: { type: "string" },
                  },
                  required: ["bodyHtml"],
                  additionalProperties: false,
                },
                video: {
                  type: "object",
                  properties: {
                    sourceAssetRef: { type: "string" },
                    youtubeUrl: { type: "string" },
                    includeRecording: { type: "boolean" },
                    transcript: { type: "string" },
                  },
                  additionalProperties: false,
                },
                exam: {
                  type: "object",
                  properties: {
                    passingScore: { type: "number" },
                    timeLimitMinutes: { type: "number" },
                    questions: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          text: { type: "string" },
                          type: {
                            type: "string",
                            enum: [
                              "MULTIPLE_CHOICE",
                              "MULTI_SELECT",
                              "TRUE_FALSE",
                              "FREE_RESPONSE",
                            ],
                          },
                          points: { type: "number" },
                          options: {
                            type: "array",
                            items: {
                              type: "object",
                              properties: {
                                text: { type: "string" },
                                isCorrect: { type: "boolean" },
                              },
                              required: ["text", "isCorrect"],
                              additionalProperties: false,
                            },
                          },
                        },
                        required: ["text", "type"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["questions"],
                  additionalProperties: false,
                },
                scenario: {
                  type: "object",
                  properties: {
                    prompt: { type: "string" },
                    backgroundInfo: { type: "string" },
                  },
                  required: ["prompt"],
                  additionalProperties: false,
                },
              },
            },
          },
        },
      },
    },
    sourceAssets: { type: "array", items: { type: "object" } },
    mediaPlacements: { type: "array", items: { type: "object" } },
  },
} as const;

export function parseCourseBlueprint(data: unknown): CourseBlueprint {
  return courseBlueprintSchema.parse(data);
}
