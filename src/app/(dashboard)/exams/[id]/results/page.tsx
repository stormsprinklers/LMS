import Link from "next/link";
import { requireUser } from "@/lib/auth-utils";
import { getExamAttempts } from "@/lib/repositories/exams";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";

export default async function ExamResultsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ score?: string; passed?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const session = await requireUser();

  const exam = await prisma.exam.findUnique({
    where: { id },
    include: { lesson: { include: { module: { include: { course: true } } } } },
  });
  if (!exam) notFound();

  const attempts = await getExamAttempts(session.user.id, id);
  const latest = attempts[0];
  const score = query.score ? Number(query.score) : latest?.score;
  const passed =
    query.passed !== undefined ? query.passed === "true" : latest?.passed;

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="font-title text-2xl font-bold text-storm-navy">
        {exam.title}
      </h1>
      <div
        className={`mt-6 rounded-xl p-6 ${passed ? "bg-emerald-50" : "bg-storm-pink/10"}`}
      >
        <p className="text-lg font-semibold text-storm-navy">
          {passed ? "Congratulations — you passed!" : "Not passed yet"}
        </p>
        {score !== null && score !== undefined && (
          <p className="mt-2 text-storm-navy/70">
            Score: {score}% (required: {exam.passingScore}%)
          </p>
        )}
      </div>
      <ul className="mt-6 space-y-2 text-sm text-storm-navy/60">
        {attempts.map((a) => (
          <li key={a.id}>
            {a.completedAt?.toLocaleDateString()} — {a.score ?? "—"}%{" "}
            {a.passed ? "Passed" : a.status === "IN_PROGRESS" ? "In progress" : "Failed"}
          </li>
        ))}
      </ul>
      <Link
        href="/exams"
        className="mt-8 inline-block text-storm-medium-blue no-underline hover:underline"
      >
        Back to exams
      </Link>
    </div>
  );
}
