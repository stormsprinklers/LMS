"use client";

import { useMemo, useState } from "react";
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
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "not_started">("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return learners.filter((row) => {
      const active =
        row.enrolled ||
        row.completedItems > 0 ||
        row.exams.some((e) => e.attemptCount > 0);
      if (filter === "active" && !active) return false;
      if (filter === "not_started" && active) return false;
      if (!q) return true;
      const hay = `${row.name ?? ""} ${row.email}`.toLowerCase();
      return hay.includes(q);
    });
  }, [learners, query, filter]);

  if (learners.length === 0) {
    return (
      <p className="text-sm text-storm-navy/60">
        No users in the organization yet.
      </p>
    );
  }

  const examHeaders =
    showExamColumns && learners[0] ? learners[0].exams : [];

  const startedCount = learners.filter(
    (r) =>
      r.enrolled ||
      r.completedItems > 0 ||
      r.exams.some((e) => e.attemptCount > 0),
  ).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search learners…"
          className="h-10 w-full max-w-sm rounded-lg border border-storm-light-blue/60 bg-white px-3 text-sm text-storm-navy outline-none focus:border-storm-medium-blue"
        />
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["all", `All (${learners.length})`],
              ["active", `Started (${startedCount})`],
              ["not_started", `Not started (${learners.length - startedCount})`],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                filter === value
                  ? "bg-storm-medium-blue text-white"
                  : "bg-storm-light-grey/60 text-storm-navy/70 hover:bg-storm-light-blue/30"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-storm-navy/60">No learners match this filter.</p>
      ) : (
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
              {filtered.map((row) => (
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
                    <div className="mt-1 flex flex-wrap gap-1">
                      {row.enrolled ? (
                        <Badge variant="info">Enrolled</Badge>
                      ) : (
                        <Badge variant="default">Not enrolled</Badge>
                      )}
                    </div>
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
      )}
    </div>
  );
}
