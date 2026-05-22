import { PageHeader } from "@/components/ui/PageHeader";
import { listCertificationRules } from "@/lib/repositories/certifications";
import { listCoursesAdmin } from "@/lib/repositories/courses";
import { CertRuleForm } from "./CertRuleForm";

export const metadata = { title: "Admin — Certifications" };

export default async function AdminCertificationsPage() {
  const [rules, courses] = await Promise.all([
    listCertificationRules(),
    listCoursesAdmin(),
  ]);

  return (
    <>
      <PageHeader
        title="Certification rules"
        description="Define credentials issued when employees complete a course and pass its exam."
      />
      <CertRuleForm courses={courses.map((c) => ({ id: c.id, title: c.title }))} />
      <ul className="mt-8 space-y-2">
        {rules.map((r) => (
          <li key={r.id} className="rounded-lg border bg-white px-4 py-3">
            <p className="font-medium text-storm-navy">{r.title}</p>
            <p className="text-sm text-storm-navy/60">
              {r.course.title} · valid {r.validityMonths} months
            </p>
          </li>
        ))}
      </ul>
    </>
  );
}
