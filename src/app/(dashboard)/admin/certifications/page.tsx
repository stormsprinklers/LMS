import { PageHeader } from "@/components/ui/PageHeader";
import { AdminArchivedLink } from "@/components/admin/AdminArchivedLink";
import { AdminListCard } from "@/components/admin/AdminListCard";
import { listCertificationRules } from "@/lib/repositories/certifications";
import { listCoursesAdmin } from "@/lib/repositories/courses";
import { CertRuleForm } from "./CertRuleForm";

export const metadata = { title: "Admin — Certifications" };

export default async function AdminCertificationsPage() {
  const [rules, courses] = await Promise.all([
    listCertificationRules(),
    listCoursesAdmin(false),
  ]);

  return (
    <>
      <PageHeader
        title="Certification rules"
        description="Define credentials issued when employees complete a course and pass its exam."
        action={<AdminArchivedLink />}
      />
      <CertRuleForm courses={courses.map((c) => ({ id: c.id, title: c.title }))} />
      <ul className="mt-8 space-y-3">
        {rules.map((r) => (
          <AdminListCard
            key={r.id}
            title={r.title}
            subtitle={`${r.course.title} · valid ${r.validityMonths} months`}
            type="certificationRule"
            id={r.id}
          />
        ))}
        {rules.length === 0 && (
          <p className="text-sm text-storm-navy/60">No active certification rules.</p>
        )}
      </ul>
    </>
  );
}
