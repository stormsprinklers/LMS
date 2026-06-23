import { NextRequest, NextResponse } from "next/server";
import { LessonProgressStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { authenticateIntegrationRequest } from "@/lib/integrations/auth";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const auth = authenticateIntegrationRequest(_request);
  if (auth !== true) return auth;

  const { id } = await params;

  const user =
    (await prisma.user.findFirst({ where: { crmUserId: id } })) ??
    (await prisma.user.findUnique({ where: { id } }));

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const enrollments = await prisma.enrollment.findMany({
    where: { userId: user.id },
    include: {
      course: {
        select: { id: true, title: true },
      },
    },
  });

  const progress = await prisma.courseItemProgress.findMany({
    where: { userId: user.id },
    include: {
      courseItem: {
        select: {
          id: true,
          title: true,
          courseId: true,
        },
      },
    },
  });

  const certifications = await prisma.certification.findMany({
    where: { userId: user.id },
    orderBy: { expiresAt: "asc" },
    select: {
      id: true,
      title: true,
      issuedAt: true,
      expiresAt: true,
    },
  });

  const recentExams = await prisma.examAttempt.findMany({
    where: { userId: user.id, passed: true },
    orderBy: { completedAt: "desc" },
    take: 5,
    select: {
      id: true,
      score: true,
      completedAt: true,
      exam: { select: { title: true } },
    },
  });

  const courses = await Promise.all(
    enrollments.map(async (enrollment) => {
      const totalItems = await prisma.courseItem.count({
        where: { courseId: enrollment.courseId, archived: false },
      });
      const completed = progress.filter(
        (p) =>
          p.courseItem.courseId === enrollment.courseId &&
          p.status === LessonProgressStatus.COMPLETED
      ).length;
      const percent = totalItems > 0 ? Math.round((completed / totalItems) * 100) : 0;
      return {
        courseId: enrollment.course.id,
        title: enrollment.course.title,
        completionPercent: percent,
        completedItems: completed,
        totalItems,
      };
    })
  );

  return NextResponse.json({
    lmsUserId: user.id,
    crmUserId: user.crmUserId,
    email: user.email,
    courses,
    certifications: certifications.map((c) => ({
      id: c.id,
      title: c.title,
      issuedAt: c.issuedAt?.toISOString() ?? null,
      expiresAt: c.expiresAt?.toISOString() ?? null,
    })),
    recentExamPasses: recentExams.map((e) => ({
      examTitle: e.exam.title,
      score: e.score,
      submittedAt: e.completedAt?.toISOString() ?? null,
    })),
  });
}
