import { PageHeader } from "@/components/ui/PageHeader";
import { GradesOverviewTable } from "@/components/admin/grades/GradesOverviewTable";
import { requireAdmin } from "@/lib/auth-utils";
import { getLearnersGradesOverview } from "@/lib/repositories/admin-grades";

export const metadata = { title: "Admin — Grades & progress" };

export default async function AdminGradesPage() {
  await requireAdmin();
  const rows = await getLearnersGradesOverview();

  return (
    <>
      <PageHeader
        title="Grades & progress"
        description="All learners with course progress or exam submissions. Open a course or exam from the list below, or from that course or exam in admin."
      />
      <GradesOverviewTable rows={rows} />
    </>
  );
}
