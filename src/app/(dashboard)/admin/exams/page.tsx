import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { AdminArchivedLink } from "@/components/admin/AdminArchivedLink";
import { AdminListCard } from "@/components/admin/AdminListCard";
import { isAdmin, isManager } from "@/lib/auth/permissions";
import { requireStaff } from "@/lib/auth-utils";
import { listExamsAdmin } from "@/lib/actions/exams-admin";

export const metadata = { title: "Admin — Exams" };

export default async function AdminExamsPage() {
  const session = await requireStaff();
  const role = (session.user as { role?: string }).role;
  const { active } = await listExamsAdmin();
  const canDestruct = isAdmin(role);

  return (
    <>
      <PageHeader
        title="Exams"
        description={
          isManager(role)
            ? "Exams you created. Edit questions and assignments; archive and delete are admin-only."
            : "Create standalone or course-linked exams, assign learners, and manage questions."
        }
        action={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {canDestruct && <AdminArchivedLink />}
            <Link
              href="/admin/exams/new"
              className="flex min-h-11 items-center justify-center rounded-lg bg-storm-pink px-4 py-2.5 text-sm font-semibold text-white no-underline"
            >
              + New exam
            </Link>
          </div>
        }
      />
      <ul className="space-y-3">
        {active.map((exam) => (
          <AdminListCard
            key={exam.id}
            href={`/admin/exams/${exam.id}`}
            title={exam.title}
            subtitle={`${exam.course?.title ?? "Standalone"} · ${exam._count.questions} questions · ${exam._count.assignments} assigned`}
            type="exam"
            id={exam.id}
            allowDestructive={canDestruct}
          />
        ))}
        {active.length === 0 && (
          <p className="text-sm text-storm-navy/60">No active exams.</p>
        )}
      </ul>
    </>
  );
}
