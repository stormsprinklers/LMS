import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireUser } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";
import { markNotificationRead } from "@/lib/actions/grading";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const session = await requireUser();
  const notifications = await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <>
      <PageHeader title="Notifications" description="Grading requests and grade updates." />
      <ul className="space-y-3">
        {notifications.map((n) => (
          <li
            key={n.id}
            className={`rounded-xl border bg-white p-4 ${!n.readAt ? "border-storm-medium-blue/40" : ""}`}
          >
            <form
              action={async () => {
                "use server";
                await markNotificationRead(n.id);
              }}
              className="space-y-3"
            >
              <div>
                <p className="font-medium text-storm-navy break-words">{n.title}</p>
                <p className="mt-1 text-sm text-storm-navy/70 break-words">{n.body}</p>
              </div>
              {n.link && (
                <Link
                  href={n.link}
                  className="flex min-h-11 w-full items-center justify-center rounded-lg bg-storm-medium-blue px-4 py-2.5 text-sm font-semibold text-white no-underline sm:w-auto sm:inline-flex"
                >
                  Open
                </Link>
              )}
              {!n.readAt && (
                <button
                  type="submit"
                  className="min-h-11 w-full text-sm text-storm-navy/50 sm:w-auto"
                >
                  Mark read
                </button>
              )}
            </form>
          </li>
        ))}
        {notifications.length === 0 && (
          <p className="text-sm text-storm-navy/60">No notifications yet.</p>
        )}
      </ul>
    </>
  );
}
