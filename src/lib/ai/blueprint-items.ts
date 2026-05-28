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
