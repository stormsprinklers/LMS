import type { CourseBlueprint } from "./blueprint-schema";
import {
  EXAM_AI_BATCH_SIZE,
  EXAM_AI_QUESTION_MAX,
  EXAM_AI_QUESTION_MIN,
  QUIZ_AI_QUESTION_COUNT,
} from "./exam-question-counts";
import { generateExamQuestions } from "./generate-exam-questions";
import type { RepairedExamQuestion } from "./repair-exam-questions";

function buildModuleContext(
  blueprint: CourseBlueprint,
  moduleIndex: number,
  itemIndex: number,
): string {
  const mod = blueprint.modules[moduleIndex];
  if (!mod) return "";

  const prior = mod.items.slice(0, itemIndex);
  const lines = prior.map((i) => {
    const bits = [`- ${i.type}: ${i.title}`];
    if (i.outline?.trim()) bits.push(`  ${i.outline.trim()}`);
    return bits.join("\n");
  });

  return [
    `Module: ${mod.title}`,
    mod.description?.trim() ? `Module description: ${mod.description.trim()}` : "",
    lines.length ? `Prior items in this module:\n${lines.join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Generate QUIZ (10) or EXAM (30–50) questions for the course AI builder. */
export async function generateCourseAssessmentQuestions(options: {
  itemType: "QUIZ" | "EXAM";
  blueprint: CourseBlueprint;
  moduleIndex: number;
  itemIndex: number;
  userPrompt: string;
}): Promise<
  | { ok: true; questions: RepairedExamQuestion[] }
  | { ok: false; error: string }
> {
  const { itemType, blueprint, moduleIndex, itemIndex, userPrompt } = options;
  const mod = blueprint.modules[moduleIndex];
  const item = mod?.items[itemIndex];
  if (!item) return { ok: false, error: "Item not found." };

  const moduleContext = buildModuleContext(blueprint, moduleIndex, itemIndex);
  const description = [item.outline?.trim(), moduleContext].filter(Boolean).join("\n\n");

  const baseParams = {
    examTitle: item.title,
    examDescription: description || blueprint.course.description || null,
    userPrompt:
      userPrompt.trim() ||
      (itemType === "QUIZ" ?
        "Write checkpoint questions on the lessons above in this module."
      : "Write a comprehensive module exam covering all prior lessons in this module."),
  };

  if (itemType === "QUIZ") {
    const result = await generateExamQuestions({
      ...baseParams,
      count: QUIZ_AI_QUESTION_COUNT,
    });
    if (!result.ok) return result;
    const questions = result.questions.slice(0, QUIZ_AI_QUESTION_COUNT);
    if (questions.length !== QUIZ_AI_QUESTION_COUNT) {
      return {
        ok: false,
        error: `Expected ${QUIZ_AI_QUESTION_COUNT} quiz questions, got ${questions.length}.`,
      };
    }
    return { ok: true, questions };
  }

  let questions: RepairedExamQuestion[] = [];
  const existingForPrompt = (): { text: string; type: string }[] =>
    questions.map((q) => ({ text: q.text, type: q.type }));

  let batchAttempts = 0;
  const maxBatches = 5;

  while (questions.length < EXAM_AI_QUESTION_MIN && batchAttempts < maxBatches) {
    batchAttempts++;
    const remaining = EXAM_AI_QUESTION_MAX - questions.length;
    const batchSize = Math.min(EXAM_AI_BATCH_SIZE, remaining);
    if (batchSize < 1) break;

    const result = await generateExamQuestions({
      ...baseParams,
      count: batchSize,
      existingQuestions: existingForPrompt(),
    });

    if (!result.ok) {
      if (questions.length >= EXAM_AI_QUESTION_MIN) break;
      return result;
    }

    questions = [...questions, ...result.questions];
  }

  if (questions.length > EXAM_AI_QUESTION_MAX) {
    questions = questions.slice(0, EXAM_AI_QUESTION_MAX);
  }

  if (questions.length < EXAM_AI_QUESTION_MIN) {
    return {
      ok: false,
      error: `Could only generate ${questions.length} exam questions (need ${EXAM_AI_QUESTION_MIN}–${EXAM_AI_QUESTION_MAX}). Try again or shorten module scope.`,
    };
  }

  return { ok: true, questions };
}
