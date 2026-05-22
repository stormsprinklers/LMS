import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { AdminArchivedLink } from "@/components/admin/AdminArchivedLink";
import { AdminListCard } from "@/components/admin/AdminListCard";
import { getGradingInbox } from "@/lib/actions/grading";

export const metadata = { title: "Grading inbox" };

export default async function GradingInboxPage() {
  const tasks = await getGradingInbox();
  const byAttempt = new Map<string, typeof tasks>();
  for (const t of tasks) {
    const list = byAttempt.get(t.attemptId) ?? [];
    list.push(t);
    byAttempt.set(t.attemptId, list);
  }

  return (
    <>
      <PageHeader
        title="Grading inbox"
        description="Free-response submissions awaiting manual grading. Archive to remove from the inbox without deleting attempt data."
        action={<AdminArchivedLink />}
      />
      <ul className="space-y-3">
        {[...byAttempt.entries()].map(([attemptId, group]) => {
          const first = group[0];
          const learner = first.attempt.user.name ?? first.attempt.user.email;
          return (
            <AdminListCard
              key={attemptId}
              href={`/admin/grading/${attemptId}`}
              title={first.attempt.exam.title}
              subtitle={`${learner} · ${group.length} question${group.length > 1 ? "s" : ""} pending · tap title to grade`}
              type="gradingAttempt"
              id={attemptId}
            />
          );
        })}
        {byAttempt.size === 0 && (
          <p className="text-sm text-storm-navy/60">No pending grading tasks.</p>
        )}
      </ul>
    </>
  );
}
