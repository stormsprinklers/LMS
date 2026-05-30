import type { BlueprintItem, CourseBlueprint } from "./blueprint-schema";

/** Shrink non-target items so rework prompts stay within token limits. */
function stripItemContentForReference(item: BlueprintItem): BlueprintItem {
  const base: BlueprintItem = {
    type: item.type,
    title: item.title,
    outline: item.outline,
    track: item.track,
    linkedSourceAssetRefs: item.linkedSourceAssetRefs,
  };

  if (item.type === "LESSON" && item.lesson?.bodyHtml) {
    return {
      ...base,
      lesson: {
        bodyHtml: `[${item.lesson.bodyHtml.length} chars of lesson HTML omitted]`,
      },
    };
  }

  if ((item.type === "QUIZ" || item.type === "EXAM") && item.exam?.questions?.length) {
    return {
      ...base,
      exam: {
        questions: item.exam.questions.map((q) => ({
          type: q.type,
          text: q.text.slice(0, 120),
        })),
      },
    };
  }

  if (item.type === "VIDEO" && item.video) {
    return {
      ...base,
      video: {
        youtubeUrl: item.video.youtubeUrl,
        sourceAssetRef: item.video.sourceAssetRef,
        transcript: item.video.transcript?.slice(0, 240),
        includeRecording: item.video.includeRecording ?? false,
      },
    };
  }

  if (item.type === "SCENARIO" && item.scenario?.prompt) {
    return {
      ...base,
      scenario: { prompt: item.scenario.prompt.slice(0, 240) },
    };
  }

  return base;
}

export function compactBlueprintForRework(
  blueprint: CourseBlueprint,
  focus?: { moduleIndex: number; itemIndex?: number },
): CourseBlueprint {
  return {
    ...blueprint,
    modules: blueprint.modules.map((mod, mi) => ({
      ...mod,
      items: mod.items.map((item, ii) => {
        const isFocus =
          focus &&
          mi === focus.moduleIndex &&
          (focus.itemIndex === undefined || ii === focus.itemIndex);
        return isFocus ? item : stripItemContentForReference(item);
      }),
    })),
  };
}

export function mergeReworkedItem(
  blueprint: CourseBlueprint,
  moduleIndex: number,
  itemIndex: number,
  item: BlueprintItem,
): CourseBlueprint {
  return {
    ...blueprint,
    modules: blueprint.modules.map((mod, mi) =>
      mi !== moduleIndex
        ? mod
        : {
            ...mod,
            items: mod.items.map((it, ii) => (ii !== itemIndex ? it : item)),
          },
    ),
  };
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
      : undefined;

  const system = `You revise a CourseBlueprint JSON (version "1.0"). Apply the user's instruction and return the FULL updated blueprint JSON. Keep unchanged sections identical.
When adding or reordering items, prefer LESSON and QUIZ items with an EXAM at the end of each module.
Items marked with omitted HTML still exist — preserve them unless the instruction changes them.`;

  const user = [
    `Instruction: ${instruction}`,
    slice ? `Focus area:\n${JSON.stringify(slice, null, 0)}` : "",
    `Blueprint to revise (return the complete updated JSON):\n${JSON.stringify(blueprint, null, 0)}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  return { system, user };
}
