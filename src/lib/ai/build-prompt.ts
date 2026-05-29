import type { AiGenerationMode, AiSourceAsset } from "@prisma/client";
import type { CourseBlueprint } from "./blueprint-schema";
import {
  type BlueprintItemType,
  formatAllowedTypesForPrompt,
  getCourseStructureGuidance,
} from "./allowed-item-types";

const MAX_CHARS_PER_ASSET = 12_000;
const MAX_TOTAL_CONTEXT = 80_000;

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n…[truncated]`;
}

export function assetsToBlueprintRefs(assets: AiSourceAsset[]) {
  return assets.map((a) => ({
    id: a.id,
    kind: a.kind,
    filename: a.filename ?? undefined,
    blobUrl: a.blobUrl ?? undefined,
    transcript: a.transcript ?? undefined,
    extractedText: a.extractedText ?? undefined,
    summary: a.summary ?? undefined,
    placementHint: a.placementHint ?? undefined,
    includeRecording: a.includeRecording,
    suggestedModuleIndex: undefined,
    suggestedItemIndex: undefined,
    muxAssetId: a.muxAssetId ?? undefined,
    muxPlaybackId: a.muxPlaybackId ?? undefined,
  })) as CourseBlueprint["sourceAssets"];
}

export function buildGenerationMessages(options: {
  mode: AiGenerationMode;
  userPrompt: string;
  courseTitle: string;
  courseDescription?: string | null;
  targetModuleTitle?: string;
  assets: AiSourceAsset[];
  allowedItemTypes: BlueprintItemType[];
}) {
  const {
    mode,
    userPrompt,
    courseTitle,
    courseDescription,
    targetModuleTitle,
    assets,
    allowedItemTypes,
  } = options;

  const assetBlocks: string[] = [];
  let total = 0;
  for (const a of assets) {
    const body =
      a.summary?.trim() ||
      a.transcript?.trim() ||
      a.extractedText?.trim() ||
      (a.kind === "embed" || a.kind === "image" ? a.blobUrl : "") ||
      "";
    if (!body && !a.placementHint) continue;
    const chunk = truncate(body, MAX_CHARS_PER_ASSET);
    if (total + chunk.length > MAX_TOTAL_CONTEXT) break;
    total += chunk.length;
    assetBlocks.push(
      [
        `### Asset ${a.id} (${a.kind})`,
        a.filename ? `File: ${a.filename}` : "",
        a.placementHint ? `Author note: ${a.placementHint}` : "",
        a.kind === "video" && !a.includeRecording
          ? "Note: use transcript only; do not create VIDEO item with recording."
          : "",
        chunk ? `Content:\n${chunk}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  const allowedBlock = `ALLOWED ITEM TYPES (use ONLY these — do not add other types): ${formatAllowedTypesForPrompt(allowedItemTypes)}.`;
  const structureGuidance = getCourseStructureGuidance(allowedItemTypes, mode);

  const modeInstructions =
    mode === "course"
      ? "Generate a full course with multiple modules using only the allowed item types."
      : mode === "module"
        ? `Generate exactly one new module${targetModuleTitle ? ` (context: "${targetModuleTitle}")` : ""} with items. Set mode to "module".`
        : `Generate item(s) in a single module. Set mode to "lesson". Target module: ${targetModuleTitle ?? "existing module"}.`;

  const system = `You are an instructional designer building training for a field-service / irrigation company.
Output ONLY valid JSON matching the CourseBlueprint schema (version "1.0").
Do NOT include sourceAssets[] in the JSON (uploads are tracked server-side).
Reference uploads only via video.sourceAssetRef or mediaPlacements with assetRef, moduleIndex (0-based), and position (intro|after_section|inline|item_end).
Prefer practical, safety-aware training content. HTML in lesson.bodyHtml should use simple tags (<p>, <ul>, <li>, <strong>).
${structureGuidance}`;

  const user = [
    `Course: ${courseTitle}`,
    courseDescription ? `Description: ${courseDescription}` : "",
    allowedBlock,
    modeInstructions,
    userPrompt ? `Author instructions:\n${userPrompt}` : "",
    assetBlocks.length ? `Source materials:\n\n${assetBlocks.join("\n\n")}` : "",
    `Return JSON with version "1.0", mode "${mode}", course metadata, modules[], and optional sourceAssets/mediaPlacements referencing asset ids above.`,
  ]
    .filter(Boolean)
    .join("\n\n");

  return { system, user };
}

export function buildStructureGenerationMessages(options: {
  mode: AiGenerationMode;
  userPrompt: string;
  courseTitle: string;
  courseDescription?: string | null;
  targetModuleTitle?: string;
  assets: AiSourceAsset[];
  allowedItemTypes: BlueprintItemType[];
}) {
  const {
    mode,
    userPrompt,
    courseTitle,
    courseDescription,
    targetModuleTitle,
    assets,
    allowedItemTypes,
  } = options;

  const base = buildGenerationMessages({
    mode,
    userPrompt,
    courseTitle,
    courseDescription,
    targetModuleTitle,
    assets,
    allowedItemTypes,
  });

  const allowedBlock = `ALLOWED ITEM TYPES (use ONLY these): ${formatAllowedTypesForPrompt(allowedItemTypes)}.`;
  const structureGuidance = getCourseStructureGuidance(allowedItemTypes, mode);

  const modeInstructions =
    mode === "course"
      ? "Generate a full course with multiple modules using only the allowed item types."
      : mode === "module"
        ? `Generate exactly one new module${targetModuleTitle ? ` (context: "${targetModuleTitle}")` : ""} with items. Set mode to "module".`
        : `Generate item(s) in a single module. Set mode to "lesson". Target module: ${targetModuleTitle ?? "existing module"}.`;

  const system = `You are an instructional designer building training for a field-service / irrigation company.
Output ONLY valid JSON for the course STRUCTURE (phase 1). Version "1.0".
${structureGuidance}
${allowedBlock}
Do NOT include lesson.bodyHtml, exam.questions, video transcripts, or other full content.
Do NOT include sourceAssets[] in JSON — reference uploads only via linkedSourceAssetRefs (exact asset id strings from source materials).`;

  const user = [
    `Course: ${courseTitle}`,
    courseDescription ? `Description: ${courseDescription}` : "",
    modeInstructions,
    userPrompt ? `Author instructions:\n${userPrompt}` : "",
    base.user.includes("Source materials:")
      ? base.user.slice(base.user.indexOf("Source materials:"))
      : "",
    `Return structure JSON: modules[] with items that each have type, title, and outline (1-3 sentences). No lesson, exam, video, or scenario content fields.`,
  ]
    .filter(Boolean)
    .join("\n\n");

  return { system, user };
}

function contentInstructionsForType(type: BlueprintItemType): string {
  switch (type) {
    case "LESSON":
      return "LESSON: rich bodyHtml (multiple sections, lists, practical steps).";
    case "VIDEO":
      return "VIDEO: sourceAssetRef and/or youtubeUrl, transcript summary if no recording.";
    case "QUIZ":
    case "EXAM":
      return "EXAM/QUIZ: at least 3 questions; every MC/MS/TRUE_FALSE question needs options with isCorrect true on at least one option.";
    case "SCENARIO":
      return "SCENARIO: detailed prompt and backgroundInfo.";
    case "SKILL_CHECK":
      return "SKILL_CHECK: traineeInstructions, evaluatorInstructions, and steps[] checklist (text, isRequired, points).";
    default:
      return "";
  }
}

export function buildItemContentUserMessage(options: {
  blueprint: CourseBlueprint;
  moduleIndex: number;
  itemIndex: number;
  assets: AiSourceAsset[];
  allowedItemTypes: BlueprintItemType[];
}) {
  const { blueprint, moduleIndex, itemIndex, assets } = options;
  const mod = blueprint.modules[moduleIndex];
  const item = mod?.items[itemIndex];
  if (!item) return "";

  const linked = item.linkedSourceAssetRefs ?? [];
  const assetNotes = assets
    .filter((a) => linked.includes(a.id))
    .map(
      (a) =>
        `- ${a.id} (${a.kind}): ${a.placementHint ?? ""} ${a.summary?.slice(0, 500) ?? a.extractedText?.slice(0, 500) ?? ""}`,
    )
    .join("\n");

  const allAssetIds = assets.map((a) => a.id).join(", ");

  return [
    `Generate full content for this curriculum item only.`,
    `Module ${moduleIndex + 1}: ${mod.title}`,
    `Item: ${JSON.stringify(item, null, 2)}`,
    allAssetIds
      ? `Valid sourceAssetRef ids (use exactly one of these for VIDEO): ${allAssetIds}`
      : "",
    linked.length
      ? `Prefer linkedSourceAssetRefs for this item: ${linked.join(", ")}`
      : "",
    assetNotes ? `Linked source excerpts:\n${assetNotes}` : "",
    `Return JSON: { "item": { ...complete item with ${item.type} content filled in... } }`,
    `Keep type, title, outline, track, and linkedSourceAssetRefs unless you must adjust them.`,
    contentInstructionsForType(item.type as BlueprintItemType),
    options.allowedItemTypes.includes(item.type as BlueprintItemType)
      ? ""
      : `WARNING: type ${item.type} was not in allowed list; still generate valid content for this type.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function buildReworkMessages(
  blueprint: CourseBlueprint,
  instruction: string,
  moduleIndex?: number,
  itemIndex?: number,
) {
  const slice =
    moduleIndex !== undefined
      ? {
          module: blueprint.modules[moduleIndex],
          moduleIndex,
          item:
            itemIndex !== undefined
              ? blueprint.modules[moduleIndex]?.items[itemIndex]
              : undefined,
          itemIndex,
        }
      : { course: blueprint.course, modules: blueprint.modules };

  const system = `You revise a CourseBlueprint JSON (version "1.0"). Apply the user's instruction to the provided slice and return the FULL updated blueprint JSON. Keep unchanged sections identical.
When adding or reordering items, prefer LESSON and QUIZ items with an EXAM at the end of each module.`;

  const user = [
    `Instruction: ${instruction}`,
    `Current blueprint slice:\n${JSON.stringify(slice, null, 2)}`,
    `Full blueprint for reference:\n${JSON.stringify(blueprint, null, 2)}`,
  ].join("\n\n");

  return { system, user };
}
