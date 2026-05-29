"use server";

import { prisma } from "@/lib/db";
import { requireManageExam } from "@/lib/auth-utils";
import {
  examAiTypeToPrisma,
  generateExamQuestions,
  type ExamAiQuestionType,
} from "@/lib/ai/generate-exam-questions";
import type { RepairedExamQuestion } from "@/lib/ai/repair-exam-questions";
import { addQuestion } from "@/lib/actions/exams-admin";
import { revalidatePath } from "next/cache";

export async function generateExamQuestionsPreview(
  examId: string,
  input: {
    prompt: string;
    count: number;
    types: ExamAiQuestionType[];
  },
): Promise<
  | { ok: true; questions: RepairedExamQuestion[] }
  | { ok: false; error: string }
> {
  await requireManageExam(examId);

  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    select: {
      title: true,
      description: true,
      questions: {
        orderBy: { sortOrder: "asc" },
        select: { text: true, type: true },
      },
    },
  });
  if (!exam) return { ok: false, error: "Exam not found." };

  const types = input.types.length > 0 ? input.types : undefined;

  return generateExamQuestions({
    examTitle: exam.title,
    examDescription: exam.description,
    userPrompt: input.prompt,
    count: input.count,
    types,
    existingQuestions: exam.questions.map((q) => ({
      text: q.text,
      type: q.type,
    })),
  });
}

export async function addGeneratedExamQuestions(
  examId: string,
  questions: RepairedExamQuestion[],
  mode: "append" | "replace",
): Promise<{ ok: true; added: number } | { ok: false; error: string }> {
  await requireManageExam(examId);

  if (!questions.length) {
    return { ok: false, error: "No questions to add." };
  }

  if (mode === "replace") {
    await prisma.question.deleteMany({ where: { examId } });
  }

  const baseOrder =
    mode === "replace" ?
      0
    : await prisma.question.count({ where: { examId } });

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const prismaType = examAiTypeToPrisma(q.type);
    await addQuestion(examId, {
      type: prismaType,
      text: q.text,
      sortOrder: baseOrder + i,
      options: q.options.map((o) => ({
        text: o.text,
        isCorrect: o.isCorrect,
      })),
    });
  }

  revalidatePath(`/admin/exams/${examId}`);
  return { ok: true, added: questions.length };
}
