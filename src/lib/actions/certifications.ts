"use server";

import { put } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireManageCourse } from "@/lib/auth-utils";
import { generateCertificationBadgeImage } from "@/lib/ai/generate-badge";

function revalidateCertPaths(courseId: string) {
  revalidatePath(`/admin/courses/${courseId}/builder`);
  revalidatePath("/admin/certifications");
  revalidatePath("/certifications");
}

export async function getCourseCertificationConfig(courseId: string) {
  await requireManageCourse(courseId);
  const [rule, courses] = await Promise.all([
    prisma.certificationRule.findFirst({
      where: { courseId, archived: false },
      include: {
        prerequisites: { select: { requiredCourseId: true } },
      },
      orderBy: { title: "asc" },
    }),
    prisma.course.findMany({
      where: { archived: false, id: { not: courseId } },
      select: { id: true, title: true, slug: true },
      orderBy: { title: "asc" },
    }),
  ]);

  return {
    rule: rule
      ? {
          id: rule.id,
          title: rule.title,
          description: rule.description,
          badgeUrl: rule.badgeUrl,
          enabled: rule.enabled,
          validityMonths: rule.validityMonths,
          prerequisiteCourseIds: rule.prerequisites.map((p) => p.requiredCourseId),
        }
      : null,
    courses,
  };
}

export async function upsertCourseCertification(
  courseId: string,
  input: {
    title: string;
    description?: string;
    enabled: boolean;
    validityMonths: number;
    prerequisiteCourseIds: string[];
  }
) {
  await requireManageCourse(courseId);
  const title = input.title.trim();
  if (!title) return { error: "Title is required." };

  const validityMonths = Math.max(1, Math.min(120, Math.round(input.validityMonths) || 12));
  const prereqIds = Array.from(
    new Set(input.prerequisiteCourseIds.filter((id) => id && id !== courseId))
  );

  const existing = await prisma.certificationRule.findFirst({
    where: { courseId, archived: false },
    orderBy: { title: "asc" },
  });

  const rule = existing
    ? await prisma.certificationRule.update({
        where: { id: existing.id },
        data: {
          title,
          description: input.description?.trim() || null,
          enabled: input.enabled,
          validityMonths,
        },
      })
    : await prisma.certificationRule.create({
        data: {
          courseId,
          title,
          description: input.description?.trim() || null,
          enabled: input.enabled,
          validityMonths,
        },
      });

  await prisma.certificationPrerequisite.deleteMany({ where: { ruleId: rule.id } });
  if (prereqIds.length) {
    await prisma.certificationPrerequisite.createMany({
      data: prereqIds.map((requiredCourseId) => ({
        ruleId: rule.id,
        requiredCourseId,
      })),
    });
  }

  // Keep CourseSettings.issueCertificate aligned with enabled flag
  await prisma.courseSettings.upsert({
    where: { courseId },
    create: { courseId, issueCertificate: input.enabled },
    update: { issueCertificate: input.enabled },
  });

  revalidateCertPaths(courseId);
  return { ok: true as const, ruleId: rule.id };
}

export async function generateCourseCertificationBadge(courseId: string) {
  await requireManageCourse(courseId);

  if (!process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    return { error: "BLOB_READ_WRITE_TOKEN is not configured on LMS." };
  }

  let rule = await prisma.certificationRule.findFirst({
    where: { courseId, archived: false },
    orderBy: { title: "asc" },
  });

  if (!rule) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { title: true },
    });
    rule = await prisma.certificationRule.create({
      data: {
        courseId,
        title: course?.title ? `${course.title} Certificate` : "Certificate",
        enabled: true,
      },
    });
  }

  try {
    const { buffer, mimeType } = await generateCertificationBadgeImage(rule.title);
    const blob = await put(`certifications/${rule.id}/badge.png`, buffer, {
      access: "public",
      token: process.env.BLOB_READ_WRITE_TOKEN,
      contentType: mimeType,
      addRandomSuffix: true,
    });
    await prisma.certificationRule.update({
      where: { id: rule.id },
      data: { badgeUrl: blob.url },
    });
    revalidateCertPaths(courseId);
    return { ok: true as const, badgeUrl: blob.url };
  } catch (error) {
    console.error("Badge generation failed:", error);
    return {
      error: error instanceof Error ? error.message : "Failed to generate badge",
    };
  }
}
