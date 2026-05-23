"use client";

import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/actions/notifications";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function MarkReadButton({ notificationId }: { notificationId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          await markNotificationRead(notificationId);
          router.refresh();
        });
      }}
      className="min-h-11 w-full text-sm font-medium text-storm-medium-blue hover:underline disabled:opacity-50 sm:w-auto"
    >
      {pending ? "Saving…" : "Mark read"}
    </button>
  );
}

export function MarkAllReadButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          await markAllNotificationsRead();
          router.refresh();
        });
      }}
      className="inline-flex min-h-11 items-center justify-center rounded-lg border border-storm-medium-blue/50 bg-white px-4 py-2 text-sm font-semibold text-storm-medium-blue hover:bg-storm-medium-blue/5 disabled:opacity-50"
    >
      {pending ? "Saving…" : "Mark all as read"}
    </button>
  );
}
