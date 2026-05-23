import Link from "next/link";
import { AttemptStatusBadge } from "./AttemptStatusBadge";
import type { ExamLearnerGradeRow } from "@/lib/repositories/admin-grades";

export function ExamGradesTable({
  learners,
  passingScore,
}: {
  learners: ExamLearnerGradeRow[];
  passingScore: number;
}) {
  if (learners.length === 0) {
    return (
      <p className="text-sm text-storm-navy/60">
        No submissions yet. Learners who submit this exam will appear here.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border bg-white">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead>
          <tr className="border-b border-storm-light-blue/40 bg-storm-light-grey/40">
            <th className="px-4 py-3 font-medium text-storm-navy">Learner</th>
            <th className="px-4 py-3 font-medium text-storm-navy">Attempts</th>
            <th className="px-4 py-3 font-medium text-storm-navy">Best</th>
            <th className="px-4 py-3 font-medium text-storm-navy">Latest</th>
            <th className="px-4 py-3 font-medium text-storm-navy">Status</th>
            <th className="px-4 py-3 font-medium text-storm-navy">Submitted</th>
            <th className="px-4 py-3 font-medium text-storm-navy" />
          </tr>
        </thead>
        <tbody>
          {learners.map((row) => (
            <tr
              key={row.userId}
              className="border-b border-storm-light-blue/20 last:border-0"
            >
              <td className="px-4 py-3">
                <p className="font-medium text-storm-navy">
                  {row.name ?? row.email}
                </p>
                {row.name && (
                  <p className="text-xs text-storm-navy/60">{row.email}</p>
                )}
              </td>
              <td className="px-4 py-3">{row.attemptCount}</td>
              <td className="px-4 py-3">
                {row.bestScore !== null ? `${row.bestScore}%` : "—"}
              </td>
              <td className="px-4 py-3">
                {row.latestScore !== null ? (
                  <span
                    className={
                      row.latestScore >= passingScore
                        ? "font-medium text-emerald-700"
                        : "font-medium text-storm-navy"
                    }
                  >
                    {row.latestScore}%
                  </span>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-4 py-3">
                <AttemptStatusBadge status={row.latestStatus} />
              </td>
              <td className="px-4 py-3 text-storm-navy/70 whitespace-nowrap">
                {row.latestCompletedAt
                  ? new Date(row.latestCompletedAt).toLocaleString()
                  : "—"}
              </td>
              <td className="px-4 py-3 text-right">
                {row.pendingGrade ? (
                  <Link
                    href={`/admin/grading/${row.latestAttemptId}`}
                    className="font-medium text-storm-medium-blue no-underline hover:underline"
                  >
                    Grade
                  </Link>
                ) : (
                  <span className="text-storm-navy/40">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
