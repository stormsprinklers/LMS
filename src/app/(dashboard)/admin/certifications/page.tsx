import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { AdminArchivedLink } from "@/components/admin/AdminArchivedLink";
import { listCertificationRules } from "@/lib/repositories/certifications";

export const metadata = { title: "Admin — Certifications" };

export default async function AdminCertificationsPage() {
  const rules = await listCertificationRules();

  return (
    <>
      <PageHeader
        title="Certifications"
        description="Overview of course certifications. Create and edit each certificate in the Course Builder Certification tab."
        action={<AdminArchivedLink />}
      />
      <ul className="mt-2 space-y-3">
        {rules.map((r) => (
          <li
            key={r.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white px-4 py-3"
          >
            <div className="flex min-w-0 items-center gap-3">
              {r.badgeUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={r.badgeUrl}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-storm-light-grey text-xs text-storm-navy/50">
                  —
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate font-medium text-storm-navy">{r.title}</p>
                <p className="truncate text-sm text-storm-navy/60">
                  {r.course.title}
                  {r.enabled ? "" : " · disabled"}
                  {` · valid ${r.validityMonths} months`}
                </p>
              </div>
            </div>
            <Link
              href={`/admin/courses/${r.courseId}/builder?tab=certification`}
              className="shrink-0 rounded-lg border border-storm-medium-blue/50 px-3 py-2 text-sm font-medium text-storm-medium-blue no-underline hover:bg-storm-medium-blue/5"
            >
              Edit in course builder
            </Link>
          </li>
        ))}
        {rules.length === 0 && (
          <p className="text-sm text-storm-navy/60">
            No certifications yet. Open a course in the builder and use the Certification tab.
          </p>
        )}
      </ul>
    </>
  );
}
