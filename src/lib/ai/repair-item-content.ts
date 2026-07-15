import type { BlueprintItem } from "./blueprint-schema";
import { normalizeLessonBodyHtml } from "./lesson-html";
import { repairLessonStormMedia } from "./media-asset-usage";

export type ItemContentValidationContext = {
  assetIds?: Set<string>;
  /** Visual media ids already used in other course items. */
  usedMediaAssetIds?: Set<string>;
  /** Visual media ids allowed in this item (0–1 for lessons). */
  assignedMediaAssetIds?: string[];
};

/** Best-effort fixes before strict validation (reduces false skips). */
export function repairGeneratedItemCandidate(
  skeleton: BlueprintItem,
  candidate: Record<string, unknown>,
  ctx?: ItemContentValidationContext,
): Record<string, unknown> {
  const merged: Record<string, unknown> = {
    ...skeleton,
    ...candidate,
    type: skeleton.type,
  };

  if (skeleton.type === "VIDEO") {
    const video =
      merged.video && typeof merged.video === "object"
        ? { ...(merged.video as Record<string, unknown>) }
        : {};

    const linked = skeleton.linkedSourceAssetRefs ?? [];
    const ref = typeof video.sourceAssetRef === "string" ? video.sourceAssetRef.trim() : "";
    const assigned = ctx?.assignedMediaAssetIds?.[0];
    const validRef =
      assigned && ctx?.assetIds?.has(assigned) ?
        assigned
      : ref && ctx?.assetIds?.has(ref) && !ctx.usedMediaAssetIds?.has(ref) ?
        ref
      : linked.find(
          (id) => ctx?.assetIds?.has(id) && !ctx.usedMediaAssetIds?.has(id),
        );

    if (validRef) {
      video.sourceAssetRef = validRef;
    } else if (ref && ctx?.usedMediaAssetIds?.has(ref)) {
      delete video.sourceAssetRef;
    }

    if (
      !video.youtubeUrl &&
      !video.sourceAssetRef &&
      !video.transcript &&
      assigned &&
      ctx?.assetIds?.has(assigned)
    ) {
      video.sourceAssetRef = assigned;
    }

    merged.video = video;
  }

  if (skeleton.type === "EXAM" || skeleton.type === "QUIZ") {
    const exam =
      merged.exam && typeof merged.exam === "object"
        ? { ...(merged.exam as Record<string, unknown>) }
        : {};
    const questions = Array.isArray(exam.questions) ? [...exam.questions] : [];

    exam.questions = questions.map((q, qi) => {
      if (!q || typeof q !== "object") {
        return {
          type: "MULTIPLE_CHOICE",
          text: `Question ${qi + 1}`,
          options: [
            { text: "True", isCorrect: true },
            { text: "False", isCorrect: false },
          ],
        };
      }
      const question = { ...(q as Record<string, unknown>) };
      if (!String(question.text ?? "").trim()) {
        question.text = `Question ${qi + 1}`;
      }

      const type = String(question.type ?? "MULTIPLE_CHOICE");
      let options: { text: string; isCorrect: boolean }[] = Array.isArray(
        question.options,
      )
        ? (question.options as unknown[]).map((o, oi) => {
            if (o && typeof o === "object") {
              const row = o as Record<string, unknown>;
              return {
                text: String(row.text ?? "").trim() || `Option ${oi + 1}`,
                isCorrect: row.isCorrect === true,
              };
            }
            return { text: String(o), isCorrect: false };
          })
        : [];

      if (type === "TRUE_FALSE") {
        if (options.length < 2) {
          options = [
            { text: "True", isCorrect: true },
            { text: "False", isCorrect: false },
          ];
        }
      } else if (
        (type === "MULTIPLE_CHOICE" || type === "MULTI_SELECT") &&
        options.length < 2
      ) {
        while (options.length < 2) {
          options.push({
            text: `Option ${String.fromCharCode(65 + options.length)}`,
            isCorrect: options.length === 0,
          });
        }
      }

      options = options.map((o, oi) => {
        const opt = { ...o };
        if (!String(opt.text ?? "").trim()) {
          opt.text =
            type === "TRUE_FALSE"
              ? oi === 0
                ? "True"
                : "False"
              : `Option ${String.fromCharCode(65 + oi)}`;
        }
        if (typeof opt.isCorrect !== "boolean") {
          opt.isCorrect = false;
        }
        return opt;
      });

      if (
        (type === "MULTIPLE_CHOICE" ||
          type === "MULTI_SELECT" ||
          type === "TRUE_FALSE") &&
        options.length > 0 &&
        !options.some((o) => o.isCorrect === true)
      ) {
        options[0] = { ...options[0], isCorrect: true };
      }

      if (type === "MULTI_SELECT") {
        const correctCount = options.filter((o) => o.isCorrect === true).length;
        if (correctCount === 0 && options.length > 0) {
          options[0] = { ...options[0], isCorrect: true };
        }
      }

      question.options = options;
      return question;
    });

    merged.exam = exam;
  }

  if (skeleton.type === "LESSON") {
    const lesson =
      merged.lesson && typeof merged.lesson === "object"
        ? { ...(merged.lesson as Record<string, unknown>) }
        : {};
    let html = String(lesson.bodyHtml ?? "").trim();
    if (!html && skeleton.outline?.trim()) {
      html = `<h2>Overview</h2>\n<p>${skeleton.outline.trim()}</p>`;
    }
    html = normalizeLessonBodyHtml(html, { repairLists: true });

    if (ctx?.assignedMediaAssetIds?.length) {
      html = repairLessonStormMedia(html, {
        allowedAssetIds: new Set(ctx.assignedMediaAssetIds),
        maxMarkers: 1,
      });
    } else {
      html = repairLessonStormMedia(html, { maxMarkers: 0 });
    }

    lesson.bodyHtml = html;
    merged.lesson = lesson;
  }

  return merged;
}

export function compactItemSummary(item: BlueprintItem): string {
  const parts = [`${item.type} "${item.title}"`];
  if (item.type === "LESSON" && item.lesson?.bodyHtml) {
    const len = item.lesson.bodyHtml.length;
    parts.push(`lesson HTML ${len} chars`);
  }
  if ((item.type === "EXAM" || item.type === "QUIZ") && item.exam?.questions) {
    parts.push(`${item.exam.questions.length} questions`);
  }
  if (item.type === "VIDEO") {
    if (item.video?.youtubeUrl) parts.push("YouTube");
    if (item.video?.sourceAssetRef) parts.push(`asset ${item.video.sourceAssetRef}`);
  }
  return `Completed: ${parts.join(", ")}.`;
}
