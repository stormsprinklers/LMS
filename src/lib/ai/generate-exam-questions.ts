import type { QuestionType } from "@prisma/client";
import {
  AI_SUMMARY_MODEL,
  requireOpenAI,
} from "./openai-client";
import {
  repairExamQuestions,
  validateRepairedExamQuestions,
  type RepairedExamQuestion,
} from "./repair-exam-questions";

export type ExamAiQuestionType = RepairedExamQuestion["type"];

export type GenerateExamQuestionsParams = {
  examTitle: string;
  examDescription?: string | null;
  userPrompt: string;
  count: number;
  types?: ExamAiQuestionType[];
  existingQuestions?: { text: string; type: string }[];
};

const examQuestionsJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["questions"],
  properties: {
    questions: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type", "text", "options"],
        properties: {
          type: {
            type: "string",
            enum: ["MULTIPLE_CHOICE", "MULTI_SELECT", "TRUE_FALSE"],
          },
          text: { type: "string" },
          options: {
            type: "array",
            minItems: 2,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["text", "isCorrect"],
              properties: {
                text: { type: "string" },
                isCorrect: { type: "boolean" },
              },
            },
          },
        },
      },
    },
  },
} as const;

const MAX_COUNT = 25;
const MIN_COUNT = 1;

function clampCount(count: number): number {
  if (!Number.isFinite(count)) return 5;
  return Math.min(MAX_COUNT, Math.max(MIN_COUNT, Math.floor(count)));
}

function buildUserMessage(params: GenerateExamQuestionsParams): string {
  const types =
    params.types?.length ?
      params.types
    : (["MULTIPLE_CHOICE", "MULTI_SELECT", "TRUE_FALSE"] as ExamAiQuestionType[]);
  const count = clampCount(params.count);
  const existing = params.existingQuestions ?? [];

  return [
    `Exam title: ${params.examTitle}`,
    params.examDescription?.trim() ?
      `Exam description: ${params.examDescription.trim()}`
    : "",
    `Generate exactly ${count} new exam questions.`,
    `Allowed question types only: ${types.join(", ")}.`,
    params.userPrompt.trim() ?
      `Author instructions:\n${params.userPrompt.trim()}`
    : "Cover the main skills and safety points implied by the exam title.",
    existing.length > 0 ?
      `Existing questions (do not duplicate; write complementary questions):\n${existing
        .slice(0, 30)
        .map((q, i) => `${i + 1}. [${q.type}] ${q.text}`)
        .join("\n")}`
    : "",
    "Return JSON: { \"questions\": [ ... ] }.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

async function requestQuestions(
  userMessage: string,
  retryIssues?: string[],
): Promise<{ questions: RepairedExamQuestion[] } | { error: string }> {
  const openai = requireOpenAI();
  const messages = [
    {
      role: "system" as const,
      content: `You write training exam questions for field-service / irrigation technicians.
Output JSON only with a "questions" array.
Rules:
- Each question has type MULTIPLE_CHOICE, MULTI_SELECT, or TRUE_FALSE.
- MULTIPLE_CHOICE: exactly 4 options, exactly one isCorrect true.
- MULTI_SELECT: 4–5 options, at least one isCorrect true (multiple allowed).
- TRUE_FALSE: exactly two options with text "True" and "False", exactly one isCorrect true.
- Questions must be clear, practical, and safety-aware.
- No trick questions; avoid "all of the above" unless type is MULTI_SELECT.`,
    },
    {
      role: "user" as const,
      content: retryIssues?.length ?
        `${userMessage}\n\nFix these validation issues from your last attempt:\n${retryIssues.map((i) => `- ${i}`).join("\n")}`
      : userMessage,
    },
  ];

  const completion = await openai.chat.completions.create({
    model: AI_SUMMARY_MODEL,
    messages,
    max_tokens: 8000,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "exam_questions",
        strict: true,
        schema: examQuestionsJsonSchema as Record<string, unknown>,
      },
    },
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) return { error: "No response from AI." };
  if (completion.choices[0]?.finish_reason === "length") {
    return { error: "Response was truncated. Try fewer questions." };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { error: "AI returned invalid JSON." };
  }

  const list =
    parsed &&
    typeof parsed === "object" &&
    "questions" in parsed &&
    Array.isArray((parsed as { questions: unknown }).questions) ?
      (parsed as { questions: unknown[] }).questions
    : [];

  const repaired = repairExamQuestions(list);
  const issues = validateRepairedExamQuestions(repaired);
  if (issues.length > 0) {
    return { error: issues.join(" ") };
  }

  return { questions: repaired };
}

export async function generateExamQuestions(
  params: GenerateExamQuestionsParams,
): Promise<
  | { ok: true; questions: RepairedExamQuestion[] }
  | { ok: false; error: string }
> {
  if (!params.examTitle.trim()) {
    return { ok: false, error: "Exam title is required." };
  }

  const userMessage = buildUserMessage(params);

  try {
    let result = await requestQuestions(userMessage);
    if ("error" in result) {
      const retry = await requestQuestions(userMessage, [result.error]);
      if ("error" in retry) {
        return { ok: false, error: retry.error };
      }
      result = retry;
    }
    return { ok: true, questions: result.questions };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Generation failed.";
    if (msg.includes("OPENAI_API_KEY")) {
      return {
        ok: false,
        error: "AI is not configured. Set OPENAI_API_KEY on the server.",
      };
    }
    return { ok: false, error: msg };
  }
}

/** Map AI / blueprint types to Prisma question types. */
export function examAiTypeToPrisma(type: ExamAiQuestionType): QuestionType {
  if (type === "MULTI_SELECT") return "MULTIPLE_SELECT";
  return "MULTIPLE_CHOICE";
}
