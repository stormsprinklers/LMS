import type { BlueprintItem, CourseBlueprint } from "./blueprint-schema";

export type FlatBlueprintItem = {
  moduleIndex: number;
  itemIndex: number;
  moduleTitle: string;
  item: BlueprintItem;
};

export function flattenBlueprintItems(blueprint: CourseBlueprint): FlatBlueprintItem[] {
  const list: FlatBlueprintItem[] = [];
  blueprint.modules.forEach((mod, moduleIndex) => {
    mod.items.forEach((item, itemIndex) => {
      list.push({ moduleIndex, itemIndex, moduleTitle: mod.title, item });
    });
  });
  return list;
}

export function itemNeedsContent(item: BlueprintItem): boolean {
  if (item.type === "LESSON") {
    const html = item.lesson?.bodyHtml?.trim() ?? "";
    return html.length < 80;
  }
  if (item.type === "VIDEO") {
    const v = item.video;
    return !v?.youtubeUrl && !v?.sourceAssetRef && !v?.transcript?.trim();
  }
  if (item.type === "EXAM" || item.type === "QUIZ") {
    return !item.exam?.questions?.length;
  }
  if (item.type === "SCENARIO") {
    return !item.scenario?.prompt?.trim();
  }
  return false;
}

export function countItemsNeedingContent(blueprint: CourseBlueprint): number {
  return flattenBlueprintItems(blueprint).filter(({ item }) => itemNeedsContent(item))
    .length;
}

export function missingContentReason(item: BlueprintItem): string {
  switch (item.type) {
    case "LESSON":
      return "Lesson body was not generated or is too short — only the outline is present.";
    case "VIDEO":
      return "Video item is missing a URL, source recording, or transcript.";
    case "QUIZ":
    case "EXAM":
      return "Assessment has no questions.";
    case "SCENARIO":
      return "Scenario prompt was not generated.";
    default:
      return "This item is missing required content.";
  }
}

/** Find items with empty content and record them in generationSkippedItems. */
export function auditIncompleteBlueprintItems(
  blueprint: CourseBlueprint,
): CourseBlueprint {
  const skipped = [...(blueprint.generationSkippedItems ?? [])];
  const seen = new Set(
    skipped.map((s) => `${s.moduleIndex}:${s.itemIndex}`),
  );

  for (const { moduleIndex, itemIndex, moduleTitle, item } of flattenBlueprintItems(
    blueprint,
  )) {
    if (!itemNeedsContent(item)) continue;
    const key = `${moduleIndex}:${itemIndex}`;
    if (seen.has(key)) continue;
    seen.add(key);
    skipped.push({
      moduleIndex,
      itemIndex,
      title: item.title,
      moduleTitle,
      reason: missingContentReason(item),
    });
  }

  return {
    ...blueprint,
    generationSkippedItems: skipped.length > 0 ? skipped : undefined,
  };
}

export function formatGenerationSkippedSummary(
  blueprint: CourseBlueprint,
): string | null {
  const skipped = blueprint.generationSkippedItems ?? [];
  if (skipped.length === 0) return null;
  const lines = skipped.map(
    (s) =>
      `• ${s.moduleTitle} → ${s.title}${s.reason ? `: ${s.reason}` : ""}`,
  );
  return `${skipped.length} item(s) need attention:\n${lines.join("\n")}`;
}
