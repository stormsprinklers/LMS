import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { listCoursesAdmin } from "@/lib/repositories/courses";
import { CreateCourseForm } from "./CreateCourseForm";

export const metadata = { title: "Admin — Courses" };

export default async function AdminCoursesPage() {
  const courses = await listCoursesAdmin();

  return (
    <>
      <PageHeader title="Courses" description="Create and edit training courses." />
      <CreateCourseForm />
      <ul className="mt-8 space-y-3">
        {courses.map((c) => (
          <li key={c.id}>
            <Link
              href={`/admin/courses/${c.slug}`}
              className="block rounded-xl border border-storm-light-blue/60 bg-white p-4 no-underline transition-shadow hover:shadow-md"
            >
              <p className="font-title font-bold text-storm-navy">{c.title}</p>
              <p className="text-sm text-storm-navy/60">
                {c.category} · {c.modules.reduce((n, m) => n + m._count.lessons, 0)} lessons
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
