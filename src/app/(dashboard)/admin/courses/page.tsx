import { PageHeader } from "@/components/ui/PageHeader";
import { AdminArchivedLink } from "@/components/admin/AdminArchivedLink";
import { AdminListCard } from "@/components/admin/AdminListCard";
import { listCoursesAdmin } from "@/lib/repositories/courses";
import { CreateCourseForm } from "./CreateCourseForm";

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
      <CreateCourseForm />
      <ul className="mt-8 space-y-3">
        {courses.map((c) => (
          <AdminListCard
            key={c.id}
            href={`/admin/courses/${c.slug}`}
            title={c.title}
            subtitle={`${c.category} · ${c.modules.reduce((n, m) => n + m._count.lessons, 0)} lessons`}
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
