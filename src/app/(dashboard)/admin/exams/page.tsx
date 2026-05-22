import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { listExamsAdmin } from "@/lib/actions/exams-admin";

export const metadata = { title: "Admin — Exams" };

export default async function AdminExamsPage() {
  const exams = await listExamsAdmin();

  return (
    <>
      <PageHeader
        title="Exams"
        description="Create standalone or course-linked exams, assign learners, and manage questions."
        action={
          <Link
            href="/admin/exams/new"
            className="flex min-h-11 items-center justify-center rounded-lg bg-storm-pink px-4 py-2.5 text-sm font-semibold text-white no-underline"
          >
            + New exam
          </Link>
        }
      />
      <ul className="space-y-3">
        {exams.map((exam) => (
          <li key={exam.id}>
            <Link
              href={`/admin/exams/${exam.id}`}
              className="block rounded-xl border bg-white p-4 no-underline hover:shadow-md"
            >
              <p className="font-title font-bold text-storm-navy">{exam.title}</p>
              <p className="text-sm text-storm-navy/60">
                {exam.course?.title ?? "Standalone"} · {exam._count.questions}{" "}
                questions · {exam._count.assignments} assigned
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
