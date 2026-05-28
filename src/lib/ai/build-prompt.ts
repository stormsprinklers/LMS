import type { AiGenerationMode, AiSourceAsset } from "@prisma/client";
import type { CourseBlueprint } from "./blueprint-schema";

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
}) {
  const { mode, userPrompt, courseTitle, courseDescription, targetModuleTitle, assets } =
    options;

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
        a.placementHint ? `Placement hint: ${a.placementHint}` : "",
        a.kind === "video" && !a.includeRecording
          ? "Note: use transcript only; do not create VIDEO item with recording."
          : "",
        chunk ? `Content:\n${chunk}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  const modeInstructions =
    mode === "course"
      ? "Generate a full course with multiple modules and varied items (lessons, videos, quizzes)."
      : mode === "module"
        ? `Generate exactly one new module${targetModuleTitle ? ` (context: "${targetModuleTitle}")` : ""} with items. Set mode to "module".`
        : `Generate lesson content as a single module with item(s) only. Set mode to "lesson". Target module: ${targetModuleTitle ?? "existing module"}.`;

  const system = `You are an instructional designer building training for a field-service / irrigation company.
Output ONLY valid JSON matching the CourseBlueprint schema (version "1.0").
Use asset ids in sourceAssetRef, mediaPlacements.assetRef, and sourceAssets[] when referencing uploads.
Prefer practical, safety-aware training content. HTML in lesson.bodyHtml should use simple tags (<p>, <ul>, <li>, <strong>).`;

  const user = [
    `Course: ${courseTitle}`,
    courseDescription ? `Description: ${courseDescription}` : "",
    modeInstructions,
    userPrompt ? `Author instructions:\n${userPrompt}` : "",
    assetBlocks.length ? `Source materials:\n\n${assetBlocks.join("\n\n")}` : "",
    `Return JSON with version "1.0", mode "${mode}", course metadata, modules[], and optional sourceAssets/mediaPlacements referencing asset ids above.`,
  ]
    .filter(Boolean)
    .join("\n\n");

  return { system, user };
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

  const system = `You revise a CourseBlueprint JSON (version "1.0"). Apply the user's instruction to the provided slice and return the FULL updated blueprint JSON. Keep unchanged sections identical.`;

  const user = [
    `Instruction: ${instruction}`,
    `Current blueprint slice:\n${JSON.stringify(slice, null, 2)}`,
    `Full blueprint for reference:\n${JSON.stringify(blueprint, null, 2)}`,
  ].join("\n\n");

  return { system, user };
}
