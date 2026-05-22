"use client";

import Link from "next/link";
import { Bell } from "lucide-react";

export function NotificationsBell({ count }: { count: number }) {
  return (
    <Link
      href="/notifications"
      className="relative flex h-11 w-11 items-center justify-center rounded-lg text-storm-navy/60 no-underline transition-colors hover:bg-storm-light-grey hover:text-storm-navy"
      aria-label={`Notifications${count ? ` (${count} unread)` : ""}`}
    >
      <Bell className="h-5 w-5" />
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-storm-pink px-1 text-[10px] font-bold text-white">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
