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
  "webpage",
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

export const generationSkippedItemSchema = z.object({
  moduleIndex: z.number().int().nonnegative(),
  itemIndex: z.number().int().nonnegative(),
  title: z.string(),
  moduleTitle: z.string(),
  reason: z.string(),
});

export const blueprintItemSchema = z.object({
  type: itemTypeSchema,
  title: z.string().min(1),
  /** Structure-phase plan; kept for context during content generation. */
  outline: z.string().optional(),
  track: trackSchema.optional(),
  isRequired: z.boolean().optional(),
  estimatedMinutes: z.number().int().positive().optional(),
  completionRule: z.string().optional(),
  linkedSourceAssetRefs: z.array(z.string()).optional(),
  lesson: lessonContentSchema.optional(),
  video: videoContentSchema.optional(),
  exam: examContentSchema.optional(),
  scenario: scenarioContentSchema.optional(),
});

export const structureItemSchema = z.object({
  type: itemTypeSchema,
  title: z.string().min(1),
  outline: z.string().min(1),
  track: trackSchema.optional(),
  isRequired: z.boolean().optional(),
  estimatedMinutes: z.number().int().positive().optional(),
  linkedSourceAssetRefs: z.array(z.string()).optional(),
});

const courseMetaSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  shortDescription: z.string().optional(),
  category: z.string().optional(),
  estimatedMinutes: z.number().int().positive().optional(),
  learningObjectives: z.array(z.string()).optional(),
});

export const courseStructureSchema = z.object({
  version: z.literal(BLUEPRINT_VERSION),
  mode: blueprintModeSchema,
  course: courseMetaSchema,
  modules: z.array(
    z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      sortOrder: z.number().int().nonnegative().optional(),
      items: z.array(structureItemSchema).default([]),
    }),
  ),
});

export type CourseStructure = z.infer<typeof courseStructureSchema>;

export const blueprintModuleSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
  items: z.array(blueprintItemSchema).default([]),
});

export const courseBlueprintSchema = z.object({
  version: z.literal(BLUEPRINT_VERSION),
  mode: blueprintModeSchema,
  course: courseMetaSchema,
  modules: z.array(blueprintModuleSchema).default([]),
  sourceAssets: z.array(sourceAssetSchema).optional(),
  mediaPlacements: z.array(mediaPlacementSchema).optional(),
  generationSkippedItems: z.array(generationSkippedItemSchema).optional(),
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
  },
} as const;

/** JSON Schema for phase 1 — structure only (no lesson bodies or exam questions). */
export const courseStructureJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["version", "mode", "course", "modules"],
  properties: {
    version: { type: "string", enum: [BLUEPRINT_VERSION] },
    mode: { type: "string", enum: ["course", "module", "lesson"] },
    course: courseBlueprintJsonSchema.properties.course,
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
              required: ["type", "title", "outline"],
              properties: {
                type: {
                  type: "string",
                  enum: ["LESSON", "VIDEO", "QUIZ", "EXAM", "SCENARIO", "SKILL_CHECK"],
                },
                title: { type: "string" },
                outline: { type: "string" },
                track: { type: "string", enum: ["LEARN", "PRACTICE", "PROVE"] },
                isRequired: { type: "boolean" },
                estimatedMinutes: { type: "number" },
                linkedSourceAssetRefs: {
                  type: "array",
                  items: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
  },
} as const;

export function normalizeStructureFromLlm(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const o = { ...(raw as Record<string, unknown>) };
  delete o.sourceAssets;
  delete o.mediaPlacements;
  if (Array.isArray(o.modules)) {
    o.modules = o.modules.map((mod) => {
      if (!mod || typeof mod !== "object") return mod;
      const m = { ...(mod as Record<string, unknown>) };
      if (Array.isArray(m.items)) {
        m.items = m.items.map((item) => {
          if (!item || typeof item !== "object") return item;
          const it = { ...(item as Record<string, unknown>) };
          delete it.lesson;
          delete it.video;
          delete it.exam;
          delete it.scenario;
          if (typeof it.outline !== "string" || !it.outline.trim()) {
            it.outline = `Cover: ${String(it.title ?? "topic")}`;
          }
          return it;
        });
      }
      return m;
    });
  }
  if (o.version !== BLUEPRINT_VERSION) o.version = BLUEPRINT_VERSION;
  return o;
}

export function parseStructureFromLlm(data: unknown): CourseStructure {
  return courseStructureSchema.parse(normalizeStructureFromLlm(data));
}

export function structureToBlueprint(
  structure: CourseStructure,
): CourseBlueprint {
  return {
    version: structure.version,
    mode: structure.mode,
    course: structure.course,
    modules: structure.modules.map((mod) => ({
      title: mod.title,
      description: mod.description,
      sortOrder: mod.sortOrder,
      items: mod.items.map((item) => ({
        type: item.type,
        title: item.title,
        outline: item.outline,
        track: item.track,
        isRequired: item.isRequired,
        estimatedMinutes: item.estimatedMinutes,
        linkedSourceAssetRefs: item.linkedSourceAssetRefs,
        ...(item.type === "LESSON" ? { lesson: { bodyHtml: "" } } : {}),
        ...(item.type === "VIDEO" ? { video: { includeRecording: true } } : {}),
        ...(item.type === "SCENARIO" ? { scenario: { prompt: "" } } : {}),
      })),
    })),
  };
}

const PLACEMENT_POSITIONS = new Set([
  "intro",
  "after_section",
  "inline",
  "item_end",
] as const);

/** Strip or fix LLM-only fields before Zod parse; source assets come from the DB. */
export function normalizeLlmBlueprint(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const o = { ...(raw as Record<string, unknown>) };

  delete o.sourceAssets;

  if (Array.isArray(o.mediaPlacements)) {
    const cleaned = o.mediaPlacements
      .map((entry) => {
        if (!entry || typeof entry !== "object") return null;
        const p = entry as Record<string, unknown>;
        const target =
          p.target && typeof p.target === "object"
            ? (p.target as Record<string, unknown>)
            : null;
        const assetRef = String(p.assetRef ?? p.id ?? "").trim();
        if (!assetRef) return null;

        let moduleIndex = p.moduleIndex ?? target?.moduleIndex;
        if (typeof moduleIndex !== "number") moduleIndex = 0;

        let itemIndex = p.itemIndex ?? target?.itemIndex;
        if (typeof itemIndex !== "number") itemIndex = undefined;

        const posRaw = String(p.position ?? "intro");
        const position = PLACEMENT_POSITIONS.has(
          posRaw as "intro" | "after_section" | "inline" | "item_end",
        )
          ? posRaw
          : "intro";

        return {
          assetRef,
          moduleIndex,
          ...(itemIndex !== undefined ? { itemIndex } : {}),
          position,
          ...(typeof p.sectionHint === "string" ? { sectionHint: p.sectionHint } : {}),
          ...(typeof p.caption === "string" ? { caption: p.caption } : {}),
        };
      })
      .filter(Boolean);
    o.mediaPlacements = cleaned.length > 0 ? cleaned : undefined;
    if (!o.mediaPlacements) delete o.mediaPlacements;
  }

  if (Array.isArray(o.modules)) {
    o.modules = o.modules.map((mod) => {
      if (!mod || typeof mod !== "object") return mod;
      const m = { ...(mod as Record<string, unknown>) };
      if (Array.isArray(m.items)) {
        m.items = m.items.map((item) => {
          if (!item || typeof item !== "object") return item;
          const it = { ...(item as Record<string, unknown>) };
          if (it.type === "LESSON" && it.lesson && typeof it.lesson === "object") {
            const lesson = { ...(it.lesson as Record<string, unknown>) };
            if (typeof lesson.bodyHtml !== "string") {
              lesson.bodyHtml = "<p></p>";
            }
            it.lesson = lesson;
          }
          return it;
        });
      }
      return m;
    });
  }

  if (o.version !== BLUEPRINT_VERSION) o.version = BLUEPRINT_VERSION;

  return o;
}

export function parseCourseBlueprint(data: unknown): CourseBlueprint {
  return courseBlueprintSchema.parse(data);
}

export function parseCourseBlueprintFromLlm(data: unknown): CourseBlueprint {
  return courseBlueprintSchema.parse(normalizeLlmBlueprint(data));
}
