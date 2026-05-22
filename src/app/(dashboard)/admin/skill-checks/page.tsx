import { PageHeader } from "@/components/ui/PageHeader";
import { requireAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";
import { SkillCheckGradeForm } from "./SkillCheckGradeForm";

export const metadata = { title: "Admin — Skill Checks" };

export default async function SkillChecksAdminPage() {
  await requireAdmin();

  const items = await prisma.courseItem.findMany({
    where: { itemType: "SKILL_CHECK", archived: false },
    include: {
      course: { select: { title: true } },
      skillCheck: {
        include: {
          completions: {
            include: { user: { select: { id: true, name: true, email: true } } },
          },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  const users = await prisma.user.findMany({
    where: { status: "ACTIVE", archived: false, role: "EMPLOYEE" },
    select: { id: true, email: true, name: true },
  });

  return (
    <>
      <PageHeader
        title="Skill check grading"
        description="Mark field pass-offs complete for trainees."
      />
      <ul className="space-y-4">
        {items.map((item) => (
          <li key={item.id} className="rounded-xl border bg-white p-4">
            <p className="font-medium text-storm-navy">{item.title}</p>
            <p className="text-xs text-storm-navy/60">{item.course.title}</p>
            <SkillCheckGradeForm
              skillCheckId={item.skillCheckId!}
              users={users}
              completions={item.skillCheck?.completions ?? []}
            />
          </li>
        ))}
        {items.length === 0 && (
          <p className="text-sm text-storm-navy/60">No skill checks in courses yet.</p>
        )}
      </ul>
    </>
  );
}
