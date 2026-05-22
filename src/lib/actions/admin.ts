"use server";

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-utils";
import { revalidatePath } from "next/cache";

export async function createCourse(data: {
  slug: string;
  title: string;
  description: string;
  category: string;
  estimatedHours: number;
}) {
  await requireAdmin();
  await prisma.course.create({
    data: {
      slug: data.slug,
      title: data.title,
      description: data.description,
      category: data.category,
      estimatedHours: data.estimatedHours,
      modules: {
        create: {
          title: "Module 1",
          sortOrder: 0,
        },
      },
    },
  });
  revalidatePath("/admin/courses");
}

export async function createLesson(data: {
  moduleId: string;
  slug: string;
  title: string;
  type: "VIDEO" | "MANUAL" | "EXAM";
  durationMinutes?: number;
}) {
  const session = await requireAdmin();
  const count = await prisma.lesson.count({ where: { moduleId: data.moduleId } });
  const lesson = await prisma.lesson.create({
    data: {
      moduleId: data.moduleId,
      slug: data.slug,
      title: data.title,
      type: data.type,
      sortOrder: count,
      durationMinutes: data.durationMinutes,
    },
  });

  if (data.type === "VIDEO") {
    await prisma.videoAsset.create({ data: { lessonId: lesson.id } });
  }
  if (data.type === "MANUAL") {
    await prisma.manualAsset.create({
      data: {
        lessonId: lesson.id,
        title: data.title,
        category: "General",
        version: "1.0",
      },
    });
  }
  if (data.type === "EXAM") {
    const mod = await prisma.module.findUnique({
      where: { id: data.moduleId },
      select: { courseId: true },
    });
    await prisma.exam.create({
      data: {
        lessonId: lesson.id,
        courseId: mod?.courseId,
        title: `${data.title} — Exam`,
        passingScore: 80,
        timeLimitMinutes: 30,
        attemptsAllowed: 3,
        published: true,
        createdById: session.user.id,
      },
    });
  }

  revalidatePath("/admin/courses");
  return lesson.id;
}

export async function addExamQuestion(
  examId: string,
  text: string,
  options: { text: string; isCorrect: boolean }[],
) {
  await requireAdmin();
  const count = await prisma.question.count({ where: { examId } });
  const question = await prisma.question.create({
    data: { examId, text, sortOrder: count, type: "MULTIPLE_CHOICE" },
  });
  await prisma.answerOption.createMany({
    data: options.map((o, i) => ({
      questionId: question.id,
      text: o.text,
      isCorrect: o.isCorrect,
      sortOrder: i,
    })),
  });
  revalidatePath(`/admin/exams/${examId}`);
}

export async function createCertificationRule(
  courseId: string,
  title: string,
  validityMonths: number,
) {
  await requireAdmin();
  await prisma.certificationRule.create({
    data: { courseId, title, validityMonths },
  });
  revalidatePath("/admin/certifications");
}
