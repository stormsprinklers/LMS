"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { getAdminSubNav, isNavActive } from "./nav-config";

export function AdminSubNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role;
  const items = getAdminSubNav(role);

  if (items.length === 0) return null;

  return (
    <div className="-mx-4 mb-6 border-b border-storm-light-blue/60 px-4 pb-4 md:mx-0 md:px-0">
      <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "shrink-0 rounded-lg px-3 py-2.5 text-sm font-medium no-underline min-h-11 flex items-center",
              isNavActive(pathname, item.href)
                ? "bg-storm-medium-blue text-white"
                : "bg-storm-light-grey/80 text-storm-navy hover:bg-storm-light-blue/40",
            )}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
