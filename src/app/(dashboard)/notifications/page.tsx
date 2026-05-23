import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  MarkAllReadButton,
  MarkReadButton,
} from "@/components/notifications/NotificationActions";
import { requireUser } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const session = await requireUser();
  const notifications = await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Grading requests and grade updates."
        action={unreadCount > 0 ? <MarkAllReadButton /> : undefined}
      />
      <ul className="space-y-3">
        {notifications.map((n) => (
          <li
            key={n.id}
            className={`rounded-xl border bg-white p-4 ${!n.readAt ? "border-storm-medium-blue/40" : ""}`}
          >
            <div className="space-y-3">
              <div>
                <p className="font-medium text-storm-navy break-words">{n.title}</p>
                <p className="mt-1 text-sm text-storm-navy/70 break-words">{n.body}</p>
                <p className="mt-1 text-xs text-storm-navy/40">
                  {n.createdAt.toLocaleString()}
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                {n.link && (
                  <Link
                    href={n.link}
                    className="inline-flex min-h-11 items-center justify-center rounded-lg bg-storm-medium-blue px-4 py-2.5 text-sm font-semibold text-white no-underline"
                  >
                    Open
                  </Link>
                )}
                {!n.readAt && <MarkReadButton notificationId={n.id} />}
              </div>
            </div>
          </li>
        ))}
        {notifications.length === 0 && (
          <p className="text-sm text-storm-navy/60">No notifications yet.</p>
        )}
      </ul>
    </>
  );
}
