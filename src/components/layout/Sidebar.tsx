"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { Logo } from "@/components/brand/Logo";
import { NavLinks } from "./NavLinks";
import { getMainNavItems } from "./nav-config";

export function Sidebar() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role;
  const items = getMainNavItems(role);

  return (
    <aside className="hidden w-64 shrink-0 flex-col bg-storm-navy text-white md:flex">
      <div className="border-b border-white/10 px-5 py-6">
        <Link href="/" className="no-underline">
          <Logo width={52} height={52} priority showText className="text-white" />
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <NavLinks items={items} />
      </div>
      <div className="border-t border-white/10 px-5 py-4 text-xs text-storm-light-blue">
        <p>Storm Sprinklers LMS</p>
        <p className="mt-1 opacity-70">Internal use only</p>
      </div>
    </aside>
  );
}
