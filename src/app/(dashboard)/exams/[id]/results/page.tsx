import Link from "next/link";
import { requireUser } from "@/lib/auth-utils";
import {
  getExamAttempts,
  getExamByIdForResults,
  getAttemptWithAnswers,
} from "@/lib/repositories/exams";
import {
  countCompletedAttempts,
  getRemainingAttempts,
} from "@/lib/exams/attempt-state";
import { notFound, redirect } from "next/navigation";

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

  if (latest?.status === "IN_PROGRESS") {
    redirect(`/exams/${id}/take`);
  }

  const remaining = await getRemainingAttempts(
    session.user.id,
    id,
    exam.attemptsAllowed,
  );
  const completedCount = await countCompletedAttempts(session.user.id, id);

  const pendingReview =
    query.pending === "1" ||
    latest?.status === "SUBMITTED_PENDING_GRADE";

  const isCompleted = Boolean(latest?.completedAt);

  const gradesHidden =
    exam.gradeVisibility === "ADMIN_ONLY" || !exam.gradesPublishedAt;

  const showScore =
    isCompleted &&
    !pendingReview &&
    (!gradesHidden || query.score !== undefined);

  const score = query.score ? Number(query.score) : latest?.score ?? undefined;
  const passed =
    query.passed !== undefined
      ? query.passed === "true"
      : latest?.passed ?? false;

  const canRetake =
    remaining > 0 && !passed && latest?.status !== "SUBMITTED_PENDING_GRADE";

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

      {!pendingReview && isCompleted && gradesHidden && !query.score && (
        <div className="mt-6 rounded-xl bg-storm-light-grey/50 p-6">
          <p className="text-lg font-semibold text-storm-navy">
            Submitted — awaiting grade publication
          </p>
          <p className="mt-2 text-sm text-storm-navy/70">
            Your instructor has not published final grades yet.
          </p>
        </div>
      )}

      {!pendingReview && !isCompleted && !latest && (
        <div className="mt-6 rounded-xl bg-storm-light-grey/50 p-6">
          <p className="text-lg font-semibold text-storm-navy">No attempts yet</p>
          <p className="mt-2 text-sm text-storm-navy/70">
            You have not submitted this exam.
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

      {completedCount >= exam.attemptsAllowed && !passed && !pendingReview && (
        <p className="mt-4 text-sm text-storm-navy/70">
          You have used all {exam.attemptsAllowed} attempt
          {exam.attemptsAllowed === 1 ? "" : "s"} for this exam.
        </p>
      )}

      {canRetake && (
        <Link
          href={`/exams/${id}/take`}
          className="mt-6 flex min-h-11 items-center justify-center rounded-lg bg-storm-medium-blue px-6 py-2.5 text-sm font-semibold text-white no-underline"
        >
          {latest ? "Retake exam" : "Start exam"}
        </Link>
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
            {a.completedAt?.toLocaleDateString() ?? "In progress"} —{" "}
            {a.status === "SUBMITTED_PENDING_GRADE"
              ? "Pending review"
              : a.status === "IN_PROGRESS"
                ? "In progress"
                : a.score !== null
                  ? `${a.score}%`
                  : "—"}{" "}
            {a.passed ? "Passed" : a.status === "FAILED" ? "Failed" : ""}
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
