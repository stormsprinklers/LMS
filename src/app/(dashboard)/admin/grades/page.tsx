import { PageHeader } from "@/components/ui/PageHeader";
import { AdminArchivedLink } from "@/components/admin/AdminArchivedLink";
import { GradesInboxList } from "@/components/admin/grades/GradesInboxList";
import { GradesOverviewTable } from "@/components/admin/grades/GradesOverviewTable";
import {
  GradesViewTabs,
  type GradesView,
} from "@/components/admin/grades/GradesViewTabs";
import { requireAdminOrCourseAdmin } from "@/lib/auth-utils";
import { getGradingInbox } from "@/lib/actions/grading";
import { getLearnersGradesOverview } from "@/lib/repositories/admin-grades";

export const metadata = { title: "Admin — Grades" };

export default async function AdminGradesPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const session = await requireAdminOrCourseAdmin();
  const role = (session.user as { role?: string }).role;
  const canViewPublished = role === "ADMIN" || role === "MANAGER";
  const { view: viewParam } = await searchParams;

  let view: GradesView =
    viewParam === "published" && canViewPublished ? "published" : "pending";

  if (view === "published" && !canViewPublished) {
    view = "pending";
  }

  const tasks = view === "pending" ? await getGradingInbox() : [];
  const rows =
    view === "published" && canViewPublished
      ? await getLearnersGradesOverview()
      : [];

  return (
    <>
      <PageHeader
        title="Grades"
        description={
          view === "pending"
            ? "Exam submissions waiting for manual review. Open an attempt to grade free-response answers."
            : "Learner course progress and exam results. Items needing review appear first in each list."
        }
        action={view === "pending" ? <AdminArchivedLink /> : undefined}
      />

      <div className="mb-6">
        <GradesViewTabs active={view} showPublished={canViewPublished} />
      </div>

      {view === "pending" ? <GradesInboxList tasks={tasks} /> : <GradesOverviewTable rows={rows} />}
    </>
  );
}
