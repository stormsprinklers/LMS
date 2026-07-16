import { put } from "@vercel/blob";
import { prisma } from "@/lib/db";
import { buildCertificatePdf } from "@/lib/certifications/pdf-template";

async function fetchImageBuffer(url: string | null | undefined): Promise<Buffer | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

/** True when the learner has satisfied CourseSettings completion rules for this course. */
export async function isCourseComplete(userId: string, courseId: string): Promise<boolean> {
  const [settings, items, progress, examPasses] = await Promise.all([
    prisma.courseSettings.findUnique({ where: { courseId } }),
    prisma.courseItem.findMany({
      where: { courseId, archived: false },
      select: {
        id: true,
        itemType: true,
        isRequired: true,
        examId: true,
      },
    }),
    prisma.courseItemProgress.findMany({
      where: {
        userId,
        courseItem: { courseId, archived: false },
      },
      select: { courseItemId: true, status: true },
    }),
    prisma.examAttempt.findMany({
      where: {
        userId,
        passed: true,
        exam: { courseId },
      },
      select: { examId: true },
    }),
  ]);

  const progressByItem = new Map(progress.map((p) => [p.courseItemId, p.status]));
  const passedExamIds = new Set(examPasses.map((e) => e.examId));

  const requireLessons = settings?.requireAllLessons ?? true;
  const requireQuizzes = settings?.requireAllQuizzes ?? true;
  const requireSkillChecks = settings?.requireAllSkillChecks ?? false;
  const finalExamRequired = settings?.finalExamRequired ?? false;

  const requiredItems = items.filter((i) => i.isRequired);
  const checkTypes = (types: string[], enabled: boolean) => {
    if (!enabled) return true;
    const subset = requiredItems.filter((i) => types.includes(i.itemType));
    if (subset.length === 0) return true;
    return subset.every((i) => progressByItem.get(i.id) === "COMPLETED");
  };

  if (!checkTypes(["LESSON", "VIDEO"], requireLessons)) return false;
  if (!checkTypes(["QUIZ"], requireQuizzes)) return false;
  if (!checkTypes(["SKILL_CHECK"], requireSkillChecks)) return false;

  if (finalExamRequired) {
    const examItems = requiredItems.filter((i) => i.itemType === "EXAM" && i.examId);
    if (examItems.length === 0) {
      // Fall back: any passed exam on this course
      if (passedExamIds.size === 0) return false;
    } else {
      for (const item of examItems) {
        const itemDone = progressByItem.get(item.id) === "COMPLETED";
        const examDone = item.examId ? passedExamIds.has(item.examId) : false;
        if (!itemDone && !examDone) return false;
      }
    }
  }

  // If no settings flags are restrictive and there are required items, require all required complete.
  if (
    !requireLessons &&
    !requireQuizzes &&
    !requireSkillChecks &&
    !finalExamRequired &&
    requiredItems.length > 0
  ) {
    return requiredItems.every((i) => progressByItem.get(i.id) === "COMPLETED");
  }

  // When lessons are required (default), also ensure every required non-exam item is done.
  if (requireLessons || requireQuizzes || requireSkillChecks) {
    return true; // already validated by checkTypes above
  }

  return requiredItems.length === 0
    ? items.length === 0 || items.every((i) => progressByItem.get(i.id) === "COMPLETED")
    : requiredItems.every((i) => progressByItem.get(i.id) === "COMPLETED");
}

export async function arePrerequisitesMet(userId: string, ruleId: string): Promise<boolean> {
  const prereqs = await prisma.certificationPrerequisite.findMany({
    where: { ruleId },
    select: { requiredCourseId: true },
  });
  if (prereqs.length === 0) return true;
  for (const p of prereqs) {
    if (!(await isCourseComplete(userId, p.requiredCourseId))) return false;
  }
  return true;
}

async function emailCertificateViaCrm(params: {
  to: string;
  learnerName: string;
  certTitle: string;
  pdfBytes: Uint8Array;
  badgeUrl?: string | null;
}) {
  const base =
    process.env.CRM_AUTH_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_CRM_URL?.replace(/\/$/, "") ||
    "";
  const key =
    process.env.INTEGRATION_API_KEY?.trim() ||
    process.env.CRM_INTEGRATION_KEY?.trim() ||
    "";
  if (!base || !key) {
    console.warn("Certificate email skipped: CRM URL or integration key missing");
    return false;
  }

  const res = await fetch(`${base}/api/integrations/lms/certificate-email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-integration-key": key,
    },
    body: JSON.stringify({
      to: params.to,
      learnerName: params.learnerName,
      certTitle: params.certTitle,
      badgeUrl: params.badgeUrl ?? null,
      pdfBase64: Buffer.from(params.pdfBytes).toString("base64"),
      pdfFileName: `${params.certTitle.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "certificate"}.pdf`,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("Certificate email failed:", res.status, text);
    return false;
  }
  return true;
}

async function awardRule(userId: string, ruleId: string) {
  const rule = await prisma.certificationRule.findFirst({
    where: { id: ruleId, archived: false, enabled: true },
    include: {
      course: { select: { id: true, title: true } },
    },
  });
  if (!rule) return null;

  if (!(await isCourseComplete(userId, rule.courseId))) return null;
  if (!(await arePrerequisitesMet(userId, rule.id))) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true },
  });
  if (!user) return null;

  const existing = await prisma.certification.findUnique({
    where: { userId_ruleId: { userId, ruleId: rule.id } },
  });
  if (existing?.status === "EARNED" && existing.pdfUrl && existing.emailedAt) {
    return existing;
  }

  const issuedAt = existing?.issuedAt ?? new Date();
  const expiresAt = new Date(issuedAt);
  expiresAt.setMonth(expiresAt.getMonth() + rule.validityMonths);

  const badgePng = await fetchImageBuffer(rule.badgeUrl);
  const pdfBytes = await buildCertificatePdf({
    learnerName: user.name || user.email,
    title: rule.title,
    description: rule.description,
    issuedAt,
    expiresAt,
    badgePng,
    courseTitle: rule.course.title,
  });

  let pdfUrl = existing?.pdfUrl ?? null;
  if (process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    const blob = await put(
      `certifications/${rule.id}/${userId}-${Date.now()}.pdf`,
      Buffer.from(pdfBytes),
      {
        access: "public",
        token: process.env.BLOB_READ_WRITE_TOKEN,
        contentType: "application/pdf",
        addRandomSuffix: false,
      }
    );
    pdfUrl = blob.url;
  }

  const cert = await prisma.certification.upsert({
    where: { userId_ruleId: { userId, ruleId: rule.id } },
    update: {
      title: rule.title,
      status: "EARNED",
      issuedAt,
      expiresAt,
      pdfUrl,
      badgeUrl: rule.badgeUrl,
    },
    create: {
      userId,
      ruleId: rule.id,
      title: rule.title,
      status: "EARNED",
      issuedAt,
      expiresAt,
      pdfUrl,
      badgeUrl: rule.badgeUrl,
    },
  });

  if (!cert.emailedAt) {
    const emailed = await emailCertificateViaCrm({
      to: user.email,
      learnerName: user.name || user.email,
      certTitle: rule.title,
      pdfBytes,
      badgeUrl: rule.badgeUrl,
    });
    if (emailed) {
      await prisma.certification.update({
        where: { id: cert.id },
        data: { emailedAt: new Date() },
      });
    }
  }

  return cert;
}

/**
 * Attempt to award the enabled certification for this course, and any other
 * certifications that list this course as a prerequisite.
 */
export async function tryAwardCertification(userId: string, courseId: string) {
  const results = [];

  const primary = await prisma.certificationRule.findFirst({
    where: { courseId, archived: false, enabled: true },
    orderBy: { title: "asc" },
  });
  if (primary) {
    results.push(await awardRule(userId, primary.id));
  }

  const dependent = await prisma.certificationPrerequisite.findMany({
    where: { requiredCourseId: courseId },
    select: { ruleId: true },
  });
  for (const dep of dependent) {
    results.push(await awardRule(userId, dep.ruleId));
  }

  return results.filter(Boolean);
}
