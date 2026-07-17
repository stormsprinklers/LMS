import { PageHeader } from "@/components/ui/PageHeader";
import { AdminArchivedLink } from "@/components/admin/AdminArchivedLink";
import { AdminListCard } from "@/components/admin/AdminListCard";
import { CopyCourseShareLink } from "@/components/courses/CopyCourseShareLink";
import { isAdmin, isManager } from "@/lib/auth/permissions";
import { requireStaff } from "@/lib/auth-utils";
import { listCoursesAdmin } from "@/lib/repositories/courses";
import Link from "next/link";

export const metadata = { title: "Admin — Courses" };

export default async function AdminCoursesPage() {
  const session = await requireStaff();
  const role = (session.user as { role?: string }).role;
  const courses = await listCoursesAdmin(
    false,
    isManager(role) ? session.user.id : undefined,
  );
  const canDestruct = isAdmin(role);

  return (
    <>
      <PageHeader
        title="Courses"
        description={
          isManager(role)
            ? "Courses you created. You can edit and assign them, but not delete them."
            : "Create and edit training courses."
        }
        action={canDestruct ? <AdminArchivedLink /> : undefined}
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
            allowDestructive={canDestruct}
            footer={
              <>
                <Link
                  href={`/admin/grades/courses/${c.id}`}
                  className="rounded-lg border border-storm-medium-blue/40 px-3 py-1.5 text-xs font-semibold text-storm-medium-blue no-underline hover:bg-storm-medium-blue/5"
                >
                  View progress
                </Link>
                <span className="text-xs font-medium text-storm-navy/60">
                  Learner link
                </span>
                <code className="break-all text-xs text-storm-medium-blue">
                  /courses/{c.slug}
                </code>
                <CopyCourseShareLink
                  slug={c.slug}
                  published={c.published && c.status === "PUBLISHED"}
                  compact
                />
              </>
            }
          />
        ))}
        {courses.length === 0 && (
          <p className="text-sm text-storm-navy/60">No active courses.</p>
        )}
      </ul>
    </>
  );
}
