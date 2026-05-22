import { PageHeader } from "@/components/ui/PageHeader";
import { AdminArchivedLink } from "@/components/admin/AdminArchivedLink";
import { AdminListCard } from "@/components/admin/AdminListCard";
import { listCoursesAdmin } from "@/lib/repositories/courses";
import Link from "next/link";

export const metadata = { title: "Admin — Courses" };

export default async function AdminCoursesPage() {
  const courses = await listCoursesAdmin(false);

  return (
    <>
      <PageHeader
        title="Courses"
        description="Create and edit training courses."
        action={<AdminArchivedLink />}
      />
      <Link
        href="/admin/courses/new"
        className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-storm-pink px-4 py-2.5 text-sm font-semibold text-white no-underline"
      >
        + Create course (builder)
      </Link>
      <ul className="mt-8 space-y-3">
        {courses.map((c) => (
          <AdminListCard
            key={c.id}
            href={`/admin/courses/${c.id}/builder`}
            title={c.title}
            subtitle={`${c.category} · ${c.status}`}
            type="course"
            id={c.id}
          />
        ))}
        {courses.length === 0 && (
          <p className="text-sm text-storm-navy/60">No active courses.</p>
        )}
      </ul>
    </>
  );
}
