import type { AiGenerationMode, AiSourceAsset } from "@prisma/client";
import type { CourseBlueprint } from "./blueprint-schema";
import {
  type BlueprintItemType,
  formatAllowedTypesForPrompt,
  getCourseStructureGuidance,
  hasVideoCapability,
} from "./allowed-item-types";
import { LESSON_HTML_AUTHORING_GUIDE } from "./lesson-html";
import { examQuestionCountPrompt } from "./exam-question-counts";
import {
  buildMediaInstructionsForItem,
  MEDIA_USAGE_GUIDE,
} from "./media-asset-usage";

const MAX_CHARS_PER_ASSET = 8_000;
const MAX_TOTAL_CONTEXT = 45_000;
/** Tighter limits for structure-only phase (summaries, not full PDF text). */
const MAX_CHARS_PER_ASSET_STRUCTURE = 4_000;
const MAX_TOTAL_CONTEXT_STRUCTURE = 24_000;

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
  discoverYoutubeVideos?: boolean;
  discoverImages?: boolean;
  /** Use smaller context budget and prefer summaries (structure phase). */
  structurePhase?: boolean;
}) {
  const {
    mode,
    userPrompt,
    courseTitle,
    courseDescription,
    targetModuleTitle,
    assets,
    allowedItemTypes,
    discoverYoutubeVideos,
    discoverImages,
    structurePhase = false,
  } = options;
  const hasVideoResource = hasVideoCapability(assets, discoverYoutubeVideos);
  const maxPerAsset = structurePhase ? MAX_CHARS_PER_ASSET_STRUCTURE : MAX_CHARS_PER_ASSET;
  const maxTotal = structurePhase ? MAX_TOTAL_CONTEXT_STRUCTURE : MAX_TOTAL_CONTEXT;

  const assetBlocks: string[] = [];
  let total = 0;
  for (const a of assets) {
    const body = structurePhase
      ? a.summary?.trim() ||
        a.placementHint?.trim() ||
        truncate(a.transcript?.trim() || a.extractedText?.trim() || "", maxPerAsset)
      : a.summary?.trim() ||
        a.transcript?.trim() ||
        a.extractedText?.trim() ||
        (a.kind === "embed" || a.kind === "image" ? a.blobUrl : "") ||
        "";
    if (!body && !a.placementHint) continue;
    const chunk = truncate(body, maxPerAsset);
    if (total + chunk.length > maxTotal) break;
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
  const structureGuidance = getCourseStructureGuidance(allowedItemTypes, mode, {
    discoverYoutubeVideos,
    discoverImages,
  });

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
Prefer practical, safety-aware training content.
${LESSON_HTML_AUTHORING_GUIDE}
${MEDIA_USAGE_GUIDE}
${hasVideoResource ? "" : "There is no usable video source in this session. Do NOT add VIDEO items to the structure."}
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
  discoverYoutubeVideos?: boolean;
  discoverImages?: boolean;
}) {
  const {
    mode,
    userPrompt,
    courseTitle,
    courseDescription,
    targetModuleTitle,
    assets,
    allowedItemTypes,
    discoverYoutubeVideos,
    discoverImages,
  } = options;
  const hasVideoResource = hasVideoCapability(assets, discoverYoutubeVideos);

  const base = buildGenerationMessages({
    mode,
    userPrompt,
    courseTitle,
    courseDescription,
    targetModuleTitle,
    assets,
    allowedItemTypes,
    discoverYoutubeVideos,
    discoverImages,
    structurePhase: true,
  });

  const allowedBlock = `ALLOWED ITEM TYPES (use ONLY these): ${formatAllowedTypesForPrompt(allowedItemTypes)}.`;
  const structureGuidance = getCourseStructureGuidance(allowedItemTypes, mode, {
    discoverYoutubeVideos,
    discoverImages,
  });

  const modeInstructions =
    mode === "course"
      ? "Generate a full course with multiple modules using only the allowed item types."
      : mode === "module"
        ? `Generate exactly one new module${targetModuleTitle ? ` (context: "${targetModuleTitle}")` : ""} with items. Set mode to "module".`
        : `Generate item(s) in a single module. Set mode to "lesson". Target module: ${targetModuleTitle ?? "existing module"}.`;

  const youtubeStructureNote = discoverYoutubeVideos
    ? " YouTube URLs will be discovered automatically during content generation — VIDEO items do not need linkedSourceAssetRefs."
    : "";

  const system = `You are an instructional designer building training for a field-service / irrigation company.
Output ONLY valid JSON for the course STRUCTURE (phase 1). Version "1.0".
${structureGuidance}
${allowedBlock}
Do NOT include lesson.bodyHtml, exam.questions, video transcripts, or other full content.
${hasVideoResource ? `VIDEO items may be included.${youtubeStructureNote}` : "No usable video source exists. Never add VIDEO items."}
Do NOT include sourceAssets[] in JSON — reference uploads only via linkedSourceAssetRefs (exact asset id strings from source materials).
Each image or video upload must appear in linkedSourceAssetRefs for at most ONE item in the whole course. Spread photos across different LESSON or VIDEO items; never assign the same id to multiple items.`;

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

function contentInstructionsForType(
  type: BlueprintItemType,
  options?: { discoverYoutubeVideos?: boolean; discoverImages?: boolean },
): string {
  switch (type) {
    case "LESSON":
      return options?.discoverImages
        ? `LESSON: ${LESSON_HTML_AUTHORING_GUIDE} Include one <storm-media> marker when an image asset is assigned to this item (auto-discovered photos are linked during generation).`
        : `LESSON: ${LESSON_HTML_AUTHORING_GUIDE} Use at most one <storm-media> marker only if this item is assigned a media asset.`;
    case "VIDEO":
      return options?.discoverYoutubeVideos
        ? "VIDEO: youtubeUrl and a short transcript summary (YouTube will be selected automatically if not specified)."
        : "VIDEO: sourceAssetRef and/or youtubeUrl, transcript summary if no recording. Use only the upload assigned to this item.";
    case "QUIZ":
      return `${examQuestionCountPrompt("QUIZ")} Every MC/MS/TRUE_FALSE question needs options with isCorrect true on at least one option (exactly one for MC/TRUE_FALSE).`;
    case "EXAM":
      return `${examQuestionCountPrompt("EXAM")} Every MC/MS/TRUE_FALSE question needs options with isCorrect true on at least one option.`;
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
  usedMediaAssetIds?: Set<string>;
  assignedMediaAssetId?: string | null;
  discoverYoutubeVideos?: boolean;
  discoverImages?: boolean;
}) {
  const {
    blueprint,
    moduleIndex,
    itemIndex,
    assets,
    usedMediaAssetIds = new Set(),
    assignedMediaAssetId = null,
    discoverYoutubeVideos,
    discoverImages,
  } = options;
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

  const mediaBlock =
    item.type === "LESSON" || item.type === "VIDEO" ?
      buildMediaInstructionsForItem({
        item,
        assets,
        usedMediaAssetIds,
        assignedMediaAssetId,
      })
    : "";

  return [
    `Generate full content for this curriculum item only.`,
    `Module ${moduleIndex + 1}: ${mod.title}`,
    `Item: ${JSON.stringify({
      type: item.type,
      title: item.title,
      outline: item.outline,
      track: item.track,
      linkedSourceAssetRefs: item.linkedSourceAssetRefs,
    })}`,
    allAssetIds
      ? `Valid sourceAssetRef ids (use exactly one of these for VIDEO): ${allAssetIds}`
      : "",
    mediaBlock,
    assetNotes ? `Linked source excerpts:\n${assetNotes}` : "",
    `Return JSON: { "item": { ...complete item with ${item.type} content filled in... } }`,
    `Keep type, title, outline, track, and linkedSourceAssetRefs unless you must adjust them.`,
    item.type === "LESSON" ? LESSON_HTML_AUTHORING_GUIDE : "",
    contentInstructionsForType(item.type as BlueprintItemType, {
      discoverYoutubeVideos,
      discoverImages,
    }),
    item.type === "VIDEO" && discoverYoutubeVideos
      ? "A related public YouTube video will be attached automatically when you omit youtubeUrl."
      : "",
    item.type === "LESSON" && discoverImages && assignedMediaAssetId
      ? "Place the assigned photo inline with <storm-media> in the section it illustrates."
      : "",
    options.allowedItemTypes.includes(item.type as BlueprintItemType)
      ? ""
      : `WARNING: type ${item.type} was not in allowed list; still generate valid content for this type.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}
