"use server";

import { prisma } from "@/lib/db";
import { canManageCourse, managerOwnsContentFilter } from "@/lib/auth/permissions";
import {
  requireAdmin,
  requireManageExam,
  requireStaff,
} from "@/lib/auth-utils";
import { revalidatePath } from "next/cache";
import type { GradeVisibility, QuestionType } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { parseQuestionsCsv } from "@/lib/exams/csv-import";
import type { QuestionInput } from "@/lib/exams/types";

function clampAttemptsAllowed(value: number) {
  if (!Number.isFinite(value) || value < 1) return 3;
  return Math.floor(value);
}

export async function createExam(data: {
  title: string;
  description?: string;
  courseId?: string;
  passingScore: number;
  timeLimitMinutes: number;
  attemptsAllowed: number;
  shuffleQuestions: boolean;
  gradeVisibility: GradeVisibility;
  userIds?: string[];
}) {
  const session = await requireStaff();
  const role = (session.user as { role?: string }).role;
  if (
    data.courseId &&
    !(await canManageCourse(session.user.id, role, data.courseId))
  ) {
    throw new Error("You can only link exams to courses you created.");
  }

  const exam = await prisma.exam.create({
    data: {
      title: data.title,
      description: data.description,
      courseId: data.courseId || null,
      createdById: session.user.id,
      passingScore: data.passingScore,
      timeLimitMinutes: data.timeLimitMinutes,
      attemptsAllowed: clampAttemptsAllowed(data.attemptsAllowed),
      shuffleQuestions: data.shuffleQuestions,
      gradeVisibility: data.gradeVisibility,
      published: true,
      assignments: data.userIds?.length
        ? {
            create: data.userIds.map((userId) => ({ userId })),
          }
        : undefined,
    },
  });
  revalidatePath("/admin/exams");
  return exam.id;
}

export async function updateExam(
  examId: string,
  data: {
    title?: string;
    description?: string;
    courseId?: string | null;
    passingScore?: number;
    timeLimitMinutes?: number;
    attemptsAllowed?: number;
    shuffleQuestions?: boolean;
    gradeVisibility?: GradeVisibility;
    published?: boolean;
  },
) {
  const session = await requireManageExam(examId);
  const role = (session.user as { role?: string }).role;
  if (
    data.courseId &&
    !(await canManageCourse(session.user.id, role, data.courseId))
  ) {
    throw new Error("You can only link exams to courses you created.");
  }
  const { attemptsAllowed, ...rest } = data;
  await prisma.exam.update({
    where: { id: examId },
    data: {
      ...rest,
      courseId: data.courseId === undefined ? undefined : data.courseId,
      ...(attemptsAllowed !== undefined
        ? { attemptsAllowed: clampAttemptsAllowed(attemptsAllowed) }
        : {}),
    },
  });
  revalidatePath(`/admin/exams/${examId}`);
  revalidatePath("/admin/exams");
}

export async function archiveExam(examId: string) {
  await requireAdmin();
  await prisma.exam.update({
    where: { id: examId },
    data: {
      archived: true,
      archivedAt: new Date(),
      published: false,
    },
  });
  revalidatePath(`/admin/exams/${examId}`);
  revalidatePath("/admin/exams");
  revalidatePath("/exams");
  return { success: true as const };
}

export async function restoreExam(examId: string) {
  await requireAdmin();
  await prisma.exam.update({
    where: { id: examId },
    data: {
      archived: false,
      archivedAt: null,
    },
  });
  revalidatePath(`/admin/exams/${examId}`);
  revalidatePath("/admin/exams");
  revalidatePath("/exams");
  return { success: true as const };
}

export async function deleteExam(examId: string) {
  await requireAdmin();
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    select: { lessonId: true, _count: { select: { attempts: true } } },
  });
  if (!exam) return { error: "Exam not found" };
  await prisma.exam.delete({ where: { id: examId } });
  revalidatePath("/admin/exams");
  revalidatePath("/exams");
  return { success: true as const };
}

export async function assignUsersToExam(examId: string, userIds: string[]) {
  await requireManageExam(examId);
  for (const userId of userIds) {
    await prisma.examAssignment.upsert({
      where: { examId_userId: { examId, userId } },
      update: {},
      create: { examId, userId },
    });
  }
  revalidatePath(`/admin/exams/${examId}`);
}

export async function removeExamAssignment(examId: string, userId: string) {
  await requireManageExam(examId);
  await prisma.examAssignment.delete({
    where: { examId_userId: { examId, userId } },
  });
  revalidatePath(`/admin/exams/${examId}`);
}

export async function assignCourseAdmin(courseId: string, userId: string) {
  await requireAdmin();
  await prisma.user.update({
    where: { id: userId },
    data: { role: "COURSE_ADMIN" },
  });
  await prisma.courseAdmin.upsert({
    where: { userId_courseId: { userId, courseId } },
    update: {},
    create: { userId, courseId },
  });
  revalidatePath(`/admin/courses`);
}

export async function removeCourseAdmin(courseId: string, userId: string) {
  await requireAdmin();
  await prisma.courseAdmin.delete({
    where: { userId_courseId: { userId, courseId } },
  });
}

export async function assignExamGrader(examId: string, userId: string) {
  await requireManageExam(examId);
  await prisma.examGrader.upsert({
    where: { examId_userId: { examId, userId } },
    update: {},
    create: { examId, userId },
  });
  revalidatePath(`/admin/exams/${examId}`);
}

export async function addQuestion(examId: string, input: QuestionInput) {
  await requireManageExam(examId);
  await validateQuestionInput(input);
  const question = await prisma.question.create({
    data: {
      examId,
      type: input.type,
      text: input.text,
      sortOrder: input.sortOrder,
      config: input.config ? (input.config as Prisma.InputJsonValue) : undefined,
      options: input.options?.length
        ? {
            create: input.options.map((o, i) => ({
              text: o.text,
              isCorrect: o.isCorrect,
              sortOrder: i,
            })),
          }
        : undefined,
    },
  });
  revalidatePath(`/admin/exams/${examId}`);
  return question.id;
}

type QuestionOptionUpdate = {
  id?: string;
  text: string;
  isCorrect: boolean;
};

export async function updateQuestion(
  examId: string,
  questionId: string,
  input: QuestionInput & { options?: QuestionOptionUpdate[] },
) {
  await requireManageExam(examId);
  await validateQuestionInput(input);

  const existing = await prisma.question.findFirst({
    where: { id: questionId, examId },
    include: { options: true },
  });
  if (!existing) throw new Error("Question not found");

  await prisma.$transaction(async (tx) => {
    await tx.question.update({
      where: { id: questionId },
      data: {
        type: input.type,
        text: input.text,
        sortOrder: input.sortOrder,
        config: input.config
          ? (input.config as Prisma.InputJsonValue)
          : Prisma.DbNull,
      },
    });

    const needsOptions =
      input.type === "MULTIPLE_CHOICE" || input.type === "MULTIPLE_SELECT";

    if (needsOptions) {
      const opts: QuestionOptionUpdate[] = (input.options ?? []).filter(
        (o) => o.text.trim(),
      );
      const keptIds = new Set<string>();

      for (let i = 0; i < opts.length; i++) {
        const o = opts[i];
        if (o.id) {
          await tx.answerOption.update({
            where: { id: o.id },
            data: { text: o.text, isCorrect: o.isCorrect, sortOrder: i },
          });
          keptIds.add(o.id);
        } else {
          const created = await tx.answerOption.create({
            data: {
              questionId,
              text: o.text,
              isCorrect: o.isCorrect,
              sortOrder: i,
            },
          });
          keptIds.add(created.id);
        }
      }

      const removeIds = existing.options
        .map((o) => o.id)
        .filter((id) => !keptIds.has(id));
      if (removeIds.length) {
        await tx.answerOption.deleteMany({ where: { id: { in: removeIds } } });
      }
    } else if (existing.options.length) {
      await tx.answerOption.deleteMany({ where: { questionId } });
    }
  });

  revalidatePath(`/admin/exams/${examId}`);
}

export async function deleteQuestion(examId: string, questionId: string) {
  await requireManageExam(examId);
  await prisma.question.delete({ where: { id: questionId } });
  revalidatePath(`/admin/exams/${examId}`);
}

export async function importQuestionsFromCsv(examId: string, csvText: string) {
  await requireManageExam(examId);
  const { questions, errors } = parseQuestionsCsv(csvText);
  if (errors.length) return { error: errors.join("\n") };
  const baseOrder = await prisma.question.count({ where: { examId } });
  for (const [i, q] of questions.entries()) {
    await addQuestion(examId, { ...q, sortOrder: baseOrder + i });
  }
  revalidatePath(`/admin/exams/${examId}`);
  return { imported: questions.length };
}

export async function publishExamGrades(examId: string) {
  await requireManageExam(examId);
  const exam = await prisma.exam.update({
    where: { id: examId },
    data: { gradesPublishedAt: new Date() },
    include: { attempts: { include: { user: true } } },
  });
  for (const attempt of exam.attempts) {
    if (attempt.status === "SUBMITTED_PENDING_GRADE") continue;
    await prisma.notification.create({
      data: {
        userId: attempt.userId,
        type: "GRADES_PUBLISHED",
        title: `Grades published: ${exam.title}`,
        body: `Your exam results for "${exam.title}" are now available.`,
        link: `/exams/${examId}/results`,
        metadata: { examId, attemptId: attempt.id },
      },
    });

    if (attempt.passed && exam.courseId) {
      const { tryAwardCertification } = await import("@/lib/certifications/award");
      await tryAwardCertification(attempt.userId, exam.courseId).catch((error) => {
        console.error("Certification award after grade publish failed:", error);
      });
    }
  }
  revalidatePath(`/admin/exams/${examId}`);
  revalidatePath("/exams");
}

async function validateQuestionInput(input: QuestionInput) {
  if (input.type === "MULTIPLE_CHOICE") {
    const correct = input.options?.filter((o) => o.isCorrect) ?? [];
    if (correct.length !== 1) throw new Error("MC needs exactly one correct answer");
  }
  if (input.type === "MULTIPLE_SELECT") {
    const correct = input.options?.filter((o) => o.isCorrect) ?? [];
    if (correct.length < 1) throw new Error("Select at least one correct answer");
  }
}

export async function listExamsAdmin() {
  const session = await requireStaff();
  const role = (session.user as { role?: string }).role;
  const own = managerOwnsContentFilter(session.user.id, role);
  const [active, archived] = await Promise.all([
    prisma.exam.findMany({
      where: {
        archived: false,
        // Curriculum-linked quizzes are managed from the course builder
        courseItem: null,
        ...own,
      },
      orderBy: { updatedAt: "desc" },
      include: {
        course: { select: { id: true, slug: true, title: true } },
        lesson: { select: { id: true, title: true } },
        _count: { select: { questions: true, assignments: true, attempts: true } },
      },
    }),
    prisma.exam.findMany({
      where: { archived: true, courseItem: null, ...own },
      orderBy: { archivedAt: "desc" },
      include: {
        course: { select: { id: true, slug: true, title: true } },
        lesson: { select: { id: true, title: true } },
        _count: { select: { questions: true, assignments: true, attempts: true } },
      },
    }),
  ]);
  return { active, archived };
}

export async function getExamAdmin(examId: string) {
  await requireManageExam(examId);
  return prisma.exam.findUnique({
    where: { id: examId },
    include: {
      course: { select: { id: true, slug: true, title: true } },
      lesson: { select: { id: true, title: true } },
      _count: { select: { attempts: true } },
      questions: {
        orderBy: { sortOrder: "asc" },
        include: { options: { orderBy: { sortOrder: "asc" } } },
      },
      assignments: { include: { user: true } },
      graders: { include: { user: true } },
    },
  });
}

export async function listUsersForAssignment() {
  await requireStaff();
  return prisma.user.findMany({
    where: { status: "ACTIVE" },
    orderBy: { name: "asc" },
    select: { id: true, email: true, name: true, jobRole: true, role: true },
  });
}

export async function listCoursesForExam() {
  const session = await requireStaff();
  const role = (session.user as { role?: string }).role;
  const own = managerOwnsContentFilter(session.user.id, role);
  return prisma.course.findMany({
    where: { archived: false, ...own },
    orderBy: { title: "asc" },
    select: { id: true, slug: true, title: true },
  });
}
