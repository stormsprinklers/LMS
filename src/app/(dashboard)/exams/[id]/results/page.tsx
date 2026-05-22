import Link from "next/link";
import { requireUser } from "@/lib/auth-utils";
import {
  getExamAttempts,
  getExamByIdForResults,
  getAttemptWithAnswers,
} from "@/lib/repositories/exams";
import { notFound } from "next/navigation";

export default async function ExamResultsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ score?: string; passed?: string; pending?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const session = await requireUser();

  const exam = await getExamByIdForResults(id);
  if (!exam) notFound();

  const attempts = await getExamAttempts(session.user.id, id);
  const latest = attempts[0];

  const pendingReview =
    query.pending === "1" ||
    latest?.status === "SUBMITTED_PENDING_GRADE";

  const gradesHidden =
    exam.gradeVisibility === "ADMIN_ONLY" || !exam.gradesPublishedAt;

  const showScore =
    !pendingReview &&
    (!gradesHidden || query.score !== undefined);

  const score = query.score ? Number(query.score) : latest?.score ?? undefined;
  const passed =
    query.passed !== undefined
      ? query.passed === "true"
      : latest?.passed ?? false;

  const detailAttempt =
    showScore && latest
      ? await getAttemptWithAnswers(latest.id, session.user.id)
      : null;

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="font-title text-2xl font-bold text-storm-navy">
        {exam.title}
      </h1>

      {pendingReview && (
        <div className="mt-6 rounded-xl bg-amber-50 p-6">
          <p className="text-lg font-semibold text-storm-navy">
            Submitted — pending review
          </p>
          <p className="mt-2 text-sm text-storm-navy/70">
            Your free-response answers are being graded. You will be notified when
            results are published.
          </p>
        </div>
      )}

      {!pendingReview && gradesHidden && !query.score && (
        <div className="mt-6 rounded-xl bg-storm-light-grey/50 p-6">
          <p className="text-lg font-semibold text-storm-navy">
            Submitted — awaiting grade publication
          </p>
          <p className="mt-2 text-sm text-storm-navy/70">
            Your instructor has not published final grades yet.
          </p>
        </div>
      )}

      {showScore && (
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
      )}

      {detailAttempt && exam.gradeVisibility === "LEARNER_VISIBLE" && (
        <ul className="mt-6 space-y-3">
          {detailAttempt.examAnswers.map((a) => (
            <li key={a.id} className="rounded-lg border p-3 text-sm">
              <p className="font-medium">{a.question.text}</p>
              {a.feedback && (
                <p className="mt-1 text-storm-navy/70">Feedback: {a.feedback}</p>
              )}
              <p className="text-storm-navy/60">
                Points: {a.manualScore ?? a.autoScore ?? "—"}%
              </p>
            </li>
          ))}
        </ul>
      )}

      <ul className="mt-6 space-y-2 text-sm text-storm-navy/60">
        {attempts.map((a) => (
          <li key={a.id}>
            {a.completedAt?.toLocaleDateString()} —{" "}
            {a.status === "SUBMITTED_PENDING_GRADE"
              ? "Pending review"
              : a.score !== null
                ? `${a.score}%`
                : "—"}{" "}
            {a.passed ? "Passed" : a.status === "IN_PROGRESS" ? "In progress" : ""}
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
