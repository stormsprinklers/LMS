import { PageHeader } from "@/components/ui/PageHeader";
import { listArchivedAdmin } from "@/lib/actions/admin-entity";
import { AdminArchivedList } from "./AdminArchivedList";
import Link from "next/link";

export const metadata = { title: "Admin — Archived" };

export default async function AdminArchivedPage() {
  const data = await listArchivedAdmin();
  const total =
    data.courses.length +
    data.exams.length +
    data.users.length +
    data.certRules.length +
    data.manuals.length +
    data.lessons.length +
    data.grading.length;

  return (
    <>
      <PageHeader
        title="Archived content"
        description="Restore items to make them active again, or delete permanently."
        action={
          <Link href="/admin" className="text-sm font-medium text-storm-medium-blue no-underline">
            ← Admin
          </Link>
        }
      />
      {total === 0 ? (
        <p className="text-sm text-storm-navy/60">Nothing is archived right now.</p>
      ) : (
        <AdminArchivedList data={data} />
      )}
    </>
  );
}
