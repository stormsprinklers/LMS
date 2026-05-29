import { ZodError } from "zod";
import {
  blueprintItemSchema,
  type BlueprintItem,
} from "./blueprint-schema";
import { tiptapDocFromHtml } from "./tiptap-from-html";
import {
  lessonHtmlUsesStormMedia,
  normalizeLessonBodyHtml,
} from "./lesson-html";
import { isYouTubeUrl } from "@/lib/video/youtube";

import type { ItemContentValidationContext } from "./repair-item-content";
import {
  repairGeneratedItemCandidate,
} from "./repair-item-content";

export type { ItemContentValidationContext };

export type ItemContentValidationResult =
  | { ok: true; item: BlueprintItem }
  | { ok: false; issues: string[] };

function formatZodIssues(error: ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length ? issue.path.join(".") : "item";
    return `${path}: ${issue.message}`;
  });
}

function validateExamQuestions(item: BlueprintItem, issues: string[]): void {
  const exam = item.exam;
  if (!exam?.questions?.length) {
    issues.push("exam.questions: Include at least one question.");
    return;
  }

  exam.questions.forEach((q, qi) => {
    const prefix = `exam.questions[${qi}]`;
    if (!q.text?.trim()) {
      issues.push(`${prefix}.text: Question text is required.`);
    }
    if (
      q.type === "MULTIPLE_CHOICE" ||
      q.type === "MULTI_SELECT" ||
      q.type === "TRUE_FALSE"
    ) {
      const options = q.options ?? [];
      if (q.type !== "TRUE_FALSE" && options.length < 2) {
        issues.push(`${prefix}.options: Include at least two answer options.`);
      }
      if (
        options.length > 0 &&
        q.type !== "MULTI_SELECT" &&
        !options.some((o) => o.isCorrect)
      ) {
        issues.push(`${prefix}.options: Mark at least one option as correct.`);
      }
      if (options.some((o) => !o.text?.trim())) {
        issues.push(`${prefix}.options: Every option needs text.`);
      }
    }
  });
}

function validateLessonContent(
  item: BlueprintItem,
  issues: string[],
  ctx?: ItemContentValidationContext,
): void {
  let html = normalizeLessonBodyHtml(item.lesson?.bodyHtml?.trim() ?? "");
  if (!html || html === "<p></p>") {
    issues.push("lesson.bodyHtml: Lesson body HTML is required.");
    return;
  }
  if (html.length < 24) {
    issues.push("lesson.bodyHtml: Lesson content is too short (write substantive HTML).");
  }
  if (!/<h2\b/i.test(html)) {
    issues.push(
      "lesson.bodyHtml: Include at least one <h2> section title for major topics.",
    );
  }
  if (!/<p\b/i.test(html)) {
    issues.push("lesson.bodyHtml: Wrap body text in <p> paragraph tags.");
  }
  if (/<script[\s>]/i.test(html)) {
    issues.push("lesson.bodyHtml: Do not include script tags.");
  }

  if (lessonHtmlUsesStormMedia(html) && ctx?.assetIds) {
    const refs = html.matchAll(/asset-id\s*=\s*["']([^"']+)["']/gi);
    for (const m of refs) {
      const id = m[1];
      if (!ctx.assetIds.has(id)) {
        issues.push(
          `lesson.bodyHtml: storm-media references unknown asset id "${id}".`,
        );
      }
    }
  }

  try {
    tiptapDocFromHtml(html, []);
  } catch {
    issues.push("lesson.bodyHtml: Could not convert HTML to lesson format.");
  }

  if (item.lesson) {
    item.lesson.bodyHtml = html;
  }
}

function validateVideoContent(
  item: BlueprintItem,
  issues: string[],
  ctx?: ItemContentValidationContext,
): void {
  const v = item.video;
  const youtubeUrl = v?.youtubeUrl?.trim() ?? "";
  const transcript = v?.transcript?.trim() ?? "";
  const sourceAssetRef = v?.sourceAssetRef?.trim() ?? "";

  if (!youtubeUrl && !sourceAssetRef && !transcript) {
    issues.push(
      "video: Provide youtubeUrl, sourceAssetRef (upload id), or transcript.",
    );
    return;
  }

  if (youtubeUrl && !isYouTubeUrl(youtubeUrl)) {
    issues.push("video.youtubeUrl: Must be a valid YouTube URL.");
  }

  if (sourceAssetRef && ctx?.assetIds && !ctx.assetIds.has(sourceAssetRef)) {
    issues.push(
      `video.sourceAssetRef: Unknown asset id "${sourceAssetRef}". Use a linked upload id from the session.`,
    );
  }
}

function validateScenarioContent(item: BlueprintItem, issues: string[]): void {
  if (!item.scenario?.prompt?.trim()) {
    issues.push("scenario.prompt: Scenario prompt is required.");
  }
}

export function validateGeneratedItemContent(
  skeleton: BlueprintItem,
  candidate: unknown,
  ctx?: ItemContentValidationContext,
): ItemContentValidationResult {
  const issues: string[] = [];

  if (!candidate || typeof candidate !== "object") {
    return { ok: false, issues: ["item: Response must be a JSON object."] };
  }

  const merged = repairGeneratedItemCandidate(
    skeleton,
    candidate && typeof candidate === "object"
      ? (candidate as Record<string, unknown>)
      : {},
    ctx,
  );

  const parsed = blueprintItemSchema.safeParse(merged);
  if (!parsed.success) {
    return { ok: false, issues: formatZodIssues(parsed.error) };
  }

  const item = parsed.data;

  if (item.type !== skeleton.type) {
    issues.push(
      `type: Must stay "${skeleton.type}" (got "${item.type}"). Do not change item type.`,
    );
  }

  if (!item.title?.trim()) {
    issues.push("title: Title is required.");
  }

  switch (item.type) {
    case "LESSON":
      validateLessonContent(item, issues, ctx);
      break;
    case "VIDEO":
      validateVideoContent(item, issues, ctx);
      break;
    case "EXAM":
    case "QUIZ":
      validateExamQuestions(item, issues);
      break;
    case "SCENARIO":
      validateScenarioContent(item, issues);
      break;
    case "SKILL_CHECK":
      break;
    default:
      break;
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return { ok: true, item };
}

export function buildItemValidationRetryMessage(issues: string[]): string {
  return [
    "Your previous JSON did not pass validation and would fail when saved to the course.",
    "Fix ONLY the listed problems. Return the same JSON shape: { \"item\": { ... } }.",
    "",
    "Issues:",
    ...issues.map((issue) => `- ${issue}`),
  ].join("\n");
}

export const MAX_VALIDATION_ATTEMPTS = 5;
export const MAX_API_ATTEMPTS = 3;

/** @deprecated Use MAX_VALIDATION_ATTEMPTS */
export const MAX_ITEM_CONTENT_ATTEMPTS = MAX_VALIDATION_ATTEMPTS;
