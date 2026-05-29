import { AdminListCard } from "@/components/admin/AdminListCard";
import type { getGradingInbox } from "@/lib/actions/grading";

type GradingTask = Awaited<ReturnType<typeof getGradingInbox>>[number];

export function GradesInboxList({ tasks }: { tasks: GradingTask[] }) {
  const byAttempt = new Map<string, GradingTask[]>();
  for (const t of tasks) {
    const list = byAttempt.get(t.attemptId) ?? [];
    list.push(t);
    byAttempt.set(t.attemptId, list);
  }

  const sortedAttempts = [...byAttempt.entries()].sort(([, aGroup], [, bGroup]) => {
    const a = aGroup[0]!.attempt;
    const b = bGroup[0]!.attempt;
    const aTime = a.completedAt?.getTime() ?? 0;
    const bTime = b.completedAt?.getTime() ?? 0;
    return aTime - bTime;
  });

  if (sortedAttempts.length === 0) {
    return (
      <p className="text-sm text-storm-navy/60">
        No exam submissions waiting for review.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {sortedAttempts.map(([attemptId, group]) => {
        const first = group[0]!;
        const learner = first.attempt.user.name ?? first.attempt.user.email;
        const submitted = first.attempt.completedAt
          ? new Date(first.attempt.completedAt).toLocaleString()
          : null;
        return (
          <AdminListCard
            key={attemptId}
            href={`/admin/grading/${attemptId}`}
            title={first.attempt.exam.title}
            subtitle={
              submitted
                ? `${learner} · submitted ${submitted} · tap to grade`
                : `${learner} · submitted for review · tap to grade`
            }
            type="gradingAttempt"
            id={attemptId}
          />
        );
      })}
    </ul>
  );
}
