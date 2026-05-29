import Link from "next/link";
import { AttemptStatusBadge } from "./AttemptStatusBadge";
import type { LearnerGradesOverviewRow } from "@/lib/repositories/admin-grades";

export function GradesOverviewTable({ rows }: { rows: LearnerGradesOverviewRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-storm-navy/60">
        No learner activity yet — enrollments, course progress, or exam submissions will
        appear here.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border bg-white">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-storm-light-blue/40 bg-storm-light-grey/40">
            <th className="px-4 py-3 font-medium text-storm-navy">Learner</th>
            <th className="px-4 py-3 font-medium text-storm-navy">Course progress</th>
            <th className="px-4 py-3 font-medium text-storm-navy">Exam results</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.userId}
              className="border-b border-storm-light-blue/20 last:border-0 align-top"
            >
              <td className="px-4 py-3">
                <p className="font-medium text-storm-navy">
                  {row.name ?? row.email}
                </p>
                {row.name && (
                  <p className="text-xs text-storm-navy/60">{row.email}</p>
                )}
              </td>
              <td className="px-4 py-3">
                {row.courses.length === 0 ? (
                  <span className="text-storm-navy/50">—</span>
                ) : (
                  <ul className="space-y-2">
                    {row.courses.map((c) => (
                      <li key={c.courseId}>
                        <Link
                          href={`/admin/grades/courses/${c.courseId}`}
                          className="font-medium text-storm-medium-blue no-underline hover:underline"
                        >
                          {c.courseTitle}
                        </Link>
                        <span className="ml-2 text-storm-navy/70">
                          {c.progressPct}% ({c.completedItems}/{c.totalItems})
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </td>
              <td className="px-4 py-3">
                {row.exams.length === 0 ? (
                  <span className="text-storm-navy/50">—</span>
                ) : (
                  <ul className="space-y-2">
                    {row.exams
                      .slice()
                      .sort((a, b) => {
                        if (a.pendingGrade !== b.pendingGrade) {
                          return a.pendingGrade ? -1 : 1;
                        }
                        return (
                          (b.latestCompletedAt?.getTime() ?? 0) -
                          (a.latestCompletedAt?.getTime() ?? 0)
                        );
                      })
                      .map((e) => (
                      <li key={e.examId} className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/admin/grades/exams/${e.examId}`}
                          className="font-medium text-storm-medium-blue no-underline hover:underline"
                        >
                          {e.examTitle}
                        </Link>
                        {e.latestScore !== null && (
                          <span className="text-storm-navy/80">{e.latestScore}%</span>
                        )}
                        <AttemptStatusBadge status={e.latestStatus} />
                        {e.pendingGrade && (
                          <Link
                            href={`/admin/grading/${e.latestAttemptId}`}
                            className="text-xs font-medium text-storm-pink no-underline hover:underline"
                          >
                            Grade →
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
