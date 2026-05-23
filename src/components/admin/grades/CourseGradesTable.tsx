import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { AttemptStatusBadge } from "./AttemptStatusBadge";
import type { CourseLearnerGradeRow } from "@/lib/repositories/admin-grades";

export function CourseGradesTable({
  learners,
  showExamColumns,
}: {
  learners: CourseLearnerGradeRow[];
  showExamColumns: boolean;
}) {
  if (learners.length === 0) {
    return (
      <p className="text-sm text-storm-navy/60">
        No learners with progress or exam submissions for this course yet.
      </p>
    );
  }

  const examHeaders =
    showExamColumns && learners[0] ? learners[0].exams : [];

  return (
    <div className="overflow-x-auto rounded-xl border bg-white">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-storm-light-blue/40 bg-storm-light-grey/40">
            <th className="sticky left-0 z-10 bg-storm-light-grey/90 px-4 py-3 font-medium text-storm-navy">
              Learner
            </th>
            <th className="px-4 py-3 font-medium text-storm-navy whitespace-nowrap">
              Progress
            </th>
            {showExamColumns &&
              examHeaders.map((exam) => (
                <th
                  key={exam.examId}
                  className="min-w-[140px] px-4 py-3 font-medium text-storm-navy"
                >
                  <Link
                    href={`/admin/grades/exams/${exam.examId}`}
                    className="text-storm-medium-blue no-underline hover:underline"
                  >
                    {exam.examTitle}
                  </Link>
                </th>
              ))}
          </tr>
        </thead>
        <tbody>
          {learners.map((row) => (
            <tr
              key={row.userId}
              className="border-b border-storm-light-blue/20 last:border-0 align-top"
            >
              <td className="sticky left-0 z-10 bg-white px-4 py-3">
                <p className="font-medium text-storm-navy">
                  {row.name ?? row.email}
                </p>
                {row.name && (
                  <p className="text-xs text-storm-navy/60">{row.email}</p>
                )}
                {!row.enrolled && (
                  <Badge variant="info" className="mt-1">
                    Not enrolled
                  </Badge>
                )}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <span className="font-medium">{row.progressPct}%</span>
                <span className="text-storm-navy/60">
                  {" "}
                  ({row.completedItems}/{row.totalItems})
                </span>
              </td>
              {showExamColumns &&
                row.exams.map((exam) => (
                  <td key={exam.examId} className="px-4 py-3">
                    {exam.attemptCount === 0 ? (
                      <span className="text-storm-navy/40">—</span>
                    ) : (
                      <div className="space-y-1">
                        {exam.latestScore !== null && (
                          <p className="font-medium text-storm-navy">
                            {exam.latestScore}%
                            {exam.bestScore !== null &&
                              exam.bestScore !== exam.latestScore && (
                                <span className="ml-1 text-xs font-normal text-storm-navy/60">
                                  (best {exam.bestScore}%)
                                </span>
                              )}
                          </p>
                        )}
                        <AttemptStatusBadge status={exam.latestStatus} />
                        {exam.pendingGrade && exam.latestAttemptId && (
                          <Link
                            href={`/admin/grading/${exam.latestAttemptId}`}
                            className="block text-xs font-medium text-storm-pink no-underline hover:underline"
                          >
                            Grade →
                          </Link>
                        )}
                      </div>
                    )}
                  </td>
                ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
