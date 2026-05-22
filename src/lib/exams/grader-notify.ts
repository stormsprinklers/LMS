import { prisma } from "@/lib/db";

/** Course admins, exam graders, or up to 5 system admins (fallback). */
export async function resolveExamGraderIds(
  examId: string,
  courseId: string | null,
): Promise<string[]> {
  const courseAdmins = courseId
    ? await prisma.courseAdmin.findMany({
        where: { courseId },
        select: { userId: true },
      })
    : [];

  if (courseAdmins.length > 0) {
    return [...new Set(courseAdmins.map((a) => a.userId))];
  }

  const examGraders = await prisma.examGrader.findMany({
    where: { examId },
    select: { userId: true },
  });
  if (examGraders.length > 0) {
    return [...new Set(examGraders.map((g) => g.userId))];
  }

  const fallbackAdmins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    take: 5,
    select: { id: true },
  });
  return fallbackAdmins.map((a) => a.id);
}

export async function notifyGradersExamSubmitted(params: {
  attemptId: string;
  examId: string;
  examTitle: string;
  courseId: string | null;
  learnerLabel: string;
  manualQuestionCount: number;
}) {
  const graderIds = await resolveExamGraderIds(params.examId, params.courseId);
  if (graderIds.length === 0) return;

  const questionLabel =
    params.manualQuestionCount === 1
      ? "1 free-response question"
      : `${params.manualQuestionCount} free-response questions`;

  for (const graderId of graderIds) {
    await prisma.notification.create({
      data: {
        userId: graderId,
        type: "FREE_RESPONSE_TO_GRADE",
        title: `Exam submitted: ${params.examTitle}`,
        body: `${params.learnerLabel} submitted their exam. ${questionLabel} need review — open to grade the attempt and adjust scores as needed.`,
        link: `/admin/grading/${params.attemptId}`,
        metadata: { attemptId: params.attemptId, examId: params.examId },
      },
    });
  }
}
