import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
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
        description="Free-response submissions awaiting manual grading."
      />
      <ul className="space-y-3">
        {[...byAttempt.entries()].map(([attemptId, group]) => {
          const first = group[0];
          return (
            <li key={attemptId}>
              <Link
                href={`/admin/grading/${attemptId}`}
                className="block min-h-11 rounded-xl border bg-white p-4 no-underline hover:shadow-md active:bg-storm-light-grey/30"
              >
                <p className="font-medium text-storm-navy">
                  {first.attempt.exam.title}
                </p>
                <p className="text-sm text-storm-navy/60">
                  {first.attempt.user.name ?? first.attempt.user.email} ·{" "}
                  {group.length} question{group.length > 1 ? "s" : ""} pending
                </p>
              </Link>
            </li>
          );
        })}
        {byAttempt.size === 0 && (
          <p className="text-sm text-storm-navy/60">No pending grading tasks.</p>
        )}
      </ul>
    </>
  );
}
