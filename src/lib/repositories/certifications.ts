import { prisma } from "@/lib/db";
import { toCertificationDTO } from "@/lib/mappers";
import type { Certification } from "@/lib/types";

export async function getCertificationsForUser(
  userId: string,
): Promise<Certification[]> {
  const rules = await prisma.certificationRule.findMany({
    where: { archived: false },
    include: { course: true },
    orderBy: { title: "asc" },
  });

  const existing = await prisma.certification.findMany({
    where: { userId },
    include: { rule: { include: { course: true } } },
  });

  const byRule = new Map(existing.map((c) => [c.ruleId, c]));
  const result: Certification[] = [];

  for (const rule of rules) {
    const cert = byRule.get(rule.id);
    if (cert) {
      result.push(
        toCertificationDTO({
          id: cert.id,
          title: cert.title,
          courseSlug: rule.course.slug,
          status: cert.status,
          issuedAt: cert.issuedAt,
          expiresAt: cert.expiresAt,
          description: rule.description ?? cert.title,
          badgeUrl: cert.badgeUrl ?? rule.badgeUrl,
          pdfUrl: cert.pdfUrl,
        }),
      );
    } else {
      result.push({
        id: `pending-${rule.id}`,
        title: rule.title,
        courseId: rule.course.slug,
        description: rule.description,
        badgeUrl: rule.badgeUrl,
        status: "in_progress",
      });
    }
  }

  return result;
}

export async function listCertificationRules() {
  return prisma.certificationRule.findMany({
    where: { archived: false },
    include: { course: true },
    orderBy: { title: "asc" },
  });
}
