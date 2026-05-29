/** Target counts when the course AI builder generates QUIZ / EXAM items. */
export const QUIZ_AI_QUESTION_COUNT = 10;
export const EXAM_AI_QUESTION_MIN = 30;
export const EXAM_AI_QUESTION_MAX = 50;
/** Default batch target for a single generation call toward the exam range. */
export const EXAM_AI_BATCH_SIZE = 20;

export function examQuestionCountPrompt(type: "QUIZ" | "EXAM"): string {
  if (type === "QUIZ") {
    return `QUIZ: exam.questions must contain exactly ${QUIZ_AI_QUESTION_COUNT} questions.`;
  }
  return `EXAM: exam.questions must contain between ${EXAM_AI_QUESTION_MIN} and ${EXAM_AI_QUESTION_MAX} questions (aim for ${EXAM_AI_QUESTION_MIN}–${EXAM_AI_QUESTION_MAX}, typically ~40).`;
}

export function validateAssessmentQuestionCount(
  itemType: "QUIZ" | "EXAM",
  count: number,
): string[] {
  const issues: string[] = [];
  if (itemType === "QUIZ") {
    if (count !== QUIZ_AI_QUESTION_COUNT) {
      issues.push(
        `exam.questions: QUIZ must have exactly ${QUIZ_AI_QUESTION_COUNT} questions (got ${count}).`,
      );
    }
  } else {
    if (count < EXAM_AI_QUESTION_MIN) {
      issues.push(
        `exam.questions: EXAM must have at least ${EXAM_AI_QUESTION_MIN} questions (got ${count}).`,
      );
    }
    if (count > EXAM_AI_QUESTION_MAX) {
      issues.push(
        `exam.questions: EXAM must have at most ${EXAM_AI_QUESTION_MAX} questions (got ${count}).`,
      );
    }
  }
  return issues;
}
