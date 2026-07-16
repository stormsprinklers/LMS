"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { NotificationsBell } from "./NotificationsBell";
import { UserMenu } from "./UserMenu";

export function HeaderBar({
  unread,
  name,
  role,
  imageUrl,
  onMenuClick,
}: {
  unread: number;
  name: string;
  role: string;
  imageUrl?: string | null;
  onMenuClick: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-14 min-h-14 items-center justify-between gap-2 border-b border-storm-light-blue/60 bg-white px-4 md:h-16 md:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <button
          type="button"
          onClick={onMenuClick}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-storm-navy transition-colors hover:bg-storm-light-grey md:hidden"
          aria-label="Open navigation menu"
        >
          <Menu className="h-6 w-6" />
        </button>
        <Link href="/" className="no-underline md:hidden">
          <Logo width={36} height={36} showText={false} />
        </Link>
        {(() => {
          const crmUrl =
            role === "ADMIN" || role === "MANAGER"
              ? process.env.NEXT_PUBLIC_CRM_URL?.replace(/\/$/, "")
              : null;
          return crmUrl ? (
            <a
              href={`${crmUrl}/settings/employees`}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden text-sm font-medium text-storm-navy underline-offset-2 hover:underline sm:inline"
            >
              CRM
            </a>
          ) : null;
        })()}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <NotificationsBell count={unread} />
        <UserMenu name={name} role={role} imageUrl={imageUrl} />
      </div>
    </header>
  );
}
