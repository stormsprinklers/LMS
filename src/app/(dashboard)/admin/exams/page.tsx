import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { listExamsAdmin } from "@/lib/actions/exams-admin";

export const metadata = { title: "Admin — Exams" };

function ExamListItem({
  exam,
}: {
  exam: {
    id: string;
    title: string;
    archived?: boolean;
    course: { title: string } | null;
    lesson: { title: string } | null;
    _count: { questions: number; assignments: number };
  };
}) {
  return (
    <Link
      href={`/admin/exams/${exam.id}`}
      className="block rounded-xl border bg-white p-4 no-underline hover:shadow-md"
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-title font-bold text-storm-navy">{exam.title}</p>
        {exam.archived && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
            Archived
          </span>
        )}
      </div>
      <p className="text-sm text-storm-navy/60">
        {exam.course?.title ?? "Standalone"}
        {exam.lesson ? ` · Lesson: ${exam.lesson.title}` : ""} · {exam._count.questions}{" "}
        questions · {exam._count.assignments} assigned
      </p>
    </Link>
  );
}

export default async function AdminExamsPage() {
  const { active, archived } = await listExamsAdmin();

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
        {active.map((exam) => (
          <li key={exam.id}>
            <ExamListItem exam={exam} />
          </li>
        ))}
        {active.length === 0 && (
          <p className="text-sm text-storm-navy/60">No active exams.</p>
        )}
      </ul>

      {archived.length > 0 && (
        <section className="mt-10">
          <h2 className="font-title text-lg font-bold text-storm-navy">Archived</h2>
          <p className="mt-1 text-sm text-storm-navy/60">
            Hidden from learners. Open an exam to restore or delete.
          </p>
          <ul className="mt-4 space-y-3">
            {archived.map((exam) => (
              <li key={exam.id}>
                <ExamListItem exam={{ ...exam, archived: true }} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
