import type { CourseBlueprint, BlueprintItem } from "./blueprint-schema";

/** Photos and videos embedded in lessons / video items — each may appear once per course. */
export function isCourseVisualMediaKind(kind: string): boolean {
  return kind === "image" || kind === "video";
}

export const MEDIA_USAGE_GUIDE = `
COURSE MEDIA RULES (photos and videos from uploads):
- Each image or video source may appear at most ONCE in the entire course.
- Never reuse the same asset-id in multiple lessons, and never repeat a photo in the same lesson.
- Only place <storm-media> or video.sourceAssetRef when this item is assigned that specific asset (see per-item instructions).
- If no media is assigned to this item, do not add <storm-media> markers and do not set video.sourceAssetRef to an upload.
- Use each image only where the surrounding text directly discusses that image; do not decorate unrelated sections.
`.trim();

export function extractStormMediaAssetIds(html: string): string[] {
  const ids: string[] = [];
  const re = /asset-id\s*=\s*["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const id = m[1]?.trim();
    if (id) ids.push(id);
  }
  return ids;
}

/** Visual media already placed in other items (excludes current item when indices provided). */
export function collectUsedVisualMediaIds(
  blueprint: CourseBlueprint,
  exclude?: { moduleIndex: number; itemIndex: number },
): Set<string> {
  const used = new Set<string>();

  blueprint.modules.forEach((mod, mi) => {
    mod.items.forEach((item, ii) => {
      if (
        exclude &&
        exclude.moduleIndex === mi &&
        exclude.itemIndex === ii
      ) {
        return;
      }
      for (const id of extractStormMediaAssetIds(item.lesson?.bodyHtml ?? "")) {
        used.add(id);
      }
      const videoRef = item.video?.sourceAssetRef?.trim();
      if (videoRef) used.add(videoRef);
    });
  });

  return used;
}

/** One unused visual asset for this item, preferring structure-linked refs. */
export function pickVisualMediaForItem(
  item: BlueprintItem,
  assets: { id: string; kind: string }[],
  usedIds: Set<string>,
): string | null {
  const visual = assets.filter((a) => isCourseVisualMediaKind(a.kind));
  const visualIds = new Set(visual.map((a) => a.id));

  const linkedVisual = (item.linkedSourceAssetRefs ?? []).filter((id) =>
    visualIds.has(id),
  );

  const unusedLinked = linkedVisual.find((id) => !usedIds.has(id));
  if (unusedLinked) return unusedLinked;

  if (linkedVisual.length > 0) {
    return null;
  }

  const unused = visual.find((a) => !usedIds.has(a.id));
  return unused?.id ?? null;
}

/**
 * Phase 1: assign each uploaded image/video to exactly one LESSON or VIDEO item
 * (round-robin across holders) so content generation does not dump all refs on one item.
 */
export function distributeVisualMediaAcrossBlueprint(
  blueprint: CourseBlueprint,
  assets: { id: string; kind: string }[],
): CourseBlueprint {
  const visual = assets.filter((a) => isCourseVisualMediaKind(a.kind));
  if (visual.length === 0) return blueprint;

  const visualIdSet = new Set(visual.map((a) => a.id));

  const holders: { mi: number; ii: number }[] = [];
  blueprint.modules.forEach((mod, mi) => {
    mod.items.forEach((item, ii) => {
      if (item.type === "LESSON" || item.type === "VIDEO") {
        holders.push({ mi, ii });
      }
    });
  });

  if (holders.length === 0) return blueprint;

  const modules = blueprint.modules.map((mod) => ({
    ...mod,
    items: mod.items.map((item) => {
      const refs = (item.linkedSourceAssetRefs ?? []).filter(
        (id) => !visualIdSet.has(id),
      );
      return { ...item, linkedSourceAssetRefs: refs };
    }),
  }));

  visual.forEach((asset, index) => {
    const { mi, ii } = holders[index % holders.length];
    const item = modules[mi].items[ii];
    item.linkedSourceAssetRefs = [
      ...(item.linkedSourceAssetRefs ?? []),
      asset.id,
    ];
  });

  return { ...blueprint, modules };
}

export function repairLessonStormMedia(
  html: string,
  options: {
    allowedAssetIds?: Set<string>;
    maxMarkers?: number;
  },
): string {
  const max = options.maxMarkers ?? 1;
  let kept = 0;

  return html.replace(/<storm-media\s+([^>]*?)\s*\/?>/gi, (match, attrs: string) => {
    const id =
      /asset-id\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1]?.trim() ||
      /asset-id\s*=\s*([^\s"'>]+)/i.exec(attrs)?.[1]?.trim();

    if (!id) return "";
    if (options.allowedAssetIds && !options.allowedAssetIds.has(id)) {
      return "";
    }
    kept++;
    if (kept > max) return "";
    return match;
  });
}

export function buildMediaInstructionsForItem(options: {
  item: BlueprintItem;
  assets: { id: string; kind: string; filename?: string | null }[];
  usedMediaAssetIds: Set<string>;
  assignedMediaAssetId: string | null;
}): string {
  const { item, assets, usedMediaAssetIds, assignedMediaAssetId } = options;
  const visual = assets.filter((a) => isCourseVisualMediaKind(a.kind));

  const alreadyUsed = [...usedMediaAssetIds].filter((id) =>
    visual.some((a) => a.id === id),
  );

  const lines: string[] = [MEDIA_USAGE_GUIDE];

  if (item.type === "LESSON") {
    if (assignedMediaAssetId) {
      const asset = visual.find((a) => a.id === assignedMediaAssetId);
      lines.push(
        `This lesson may include at most ONE <storm-media> marker, using asset-id="${assignedMediaAssetId}"${asset?.filename ? ` (${asset.filename})` : ""}. Place it only in the section that discusses this image/video.`,
      );
    } else {
      lines.push(
        "This lesson has no photo/video assigned. Do not add any <storm-media> markers.",
      );
    }
  }

  if (item.type === "VIDEO" && assignedMediaAssetId) {
    lines.push(
      `Set video.sourceAssetRef to "${assignedMediaAssetId}" for this item's recording (if applicable). Do not use other upload ids.`,
    );
  }

  if (alreadyUsed.length > 0) {
    lines.push(
      `Already used elsewhere in this course (do NOT use again): ${alreadyUsed.join(", ")}.`,
    );
  }

  const remaining = visual
    .filter((a) => !usedMediaAssetIds.has(a.id) && a.id !== assignedMediaAssetId)
    .map((a) => a.id);
  if (remaining.length > 0 && !assignedMediaAssetId) {
    lines.push(
      `Unused visual assets (for other items only): ${remaining.join(", ")}.`,
    );
  }

  return lines.join("\n");
}
