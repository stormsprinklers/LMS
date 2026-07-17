import { PageHeader } from "@/components/ui/PageHeader";
import { AdminArchivedLink } from "@/components/admin/AdminArchivedLink";
import { GradesInboxList } from "@/components/admin/grades/GradesInboxList";
import { GradesOverviewTable } from "@/components/admin/grades/GradesOverviewTable";
import {
  GradesViewTabs,
  type GradesView,
} from "@/components/admin/grades/GradesViewTabs";
import { requireAdminOrCourseAdmin } from "@/lib/auth-utils";
import { isManager } from "@/lib/auth/permissions";
import { getGradingInbox } from "@/lib/actions/grading";
import { getLearnersGradesOverview } from "@/lib/repositories/admin-grades";
import { listCoursesAdmin } from "@/lib/repositories/courses";
import Link from "next/link";

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
  const courses =
    view === "published" && canViewPublished
      ? await listCoursesAdmin(
          false,
          isManager(role) ? session.user.id : undefined,
        )
      : [];

  return (
    <>
      <PageHeader
        title="Grades"
        description={
          view === "pending"
            ? "Exam submissions waiting for manual review. Open an attempt to grade free-response answers."
            : "Learner course progress and exam results across the organization. Open a course to see every user."
        }
        action={view === "pending" ? <AdminArchivedLink /> : undefined}
      />

      <div className="mb-6">
        <GradesViewTabs active={view} showPublished={canViewPublished} />
      </div>

      {view === "pending" ? (
        <GradesInboxList tasks={tasks} />
      ) : (
        <div className="space-y-8">
          {courses.length > 0 ? (
            <section>
              <h2 className="font-title text-base font-bold text-storm-navy">
                Progress by course
              </h2>
              <p className="mt-1 text-sm text-storm-navy/60">
                View completion for all users in the organization for each course.
              </p>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {courses.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/admin/grades/courses/${c.id}`}
                      className="flex items-center justify-between rounded-xl border border-storm-light-blue/60 bg-white px-4 py-3 text-sm font-medium text-storm-navy no-underline hover:border-storm-medium-blue/50 hover:shadow-sm"
                    >
                      <span className="min-w-0 truncate">{c.title}</span>
                      <span className="ml-3 shrink-0 text-xs font-semibold text-storm-medium-blue">
                        View →
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          <section>
            <h2 className="font-title text-base font-bold text-storm-navy">
              By learner
            </h2>
            <p className="mb-3 mt-1 text-sm text-storm-navy/60">
              All learners with course or exam activity.
            </p>
            <GradesOverviewTable rows={rows} />
          </section>
        </div>
      )}
    </>
  );
}
