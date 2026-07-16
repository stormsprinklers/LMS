"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Sidebar } from "./Sidebar";
import { NavDrawer } from "./NavDrawer";
import { HeaderBar } from "./HeaderBar";
import { getMainNavItems } from "./nav-config";

export function MobileShell({
  children,
  unread,
  userName,
  userRole,
  userImageUrl,
}: {
  children: React.ReactNode;
  unread: number;
  userName: string;
  userRole: string;
  userImageUrl?: string | null;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();
  const { data: session } = useSession();

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);
  const role = (session?.user as { role?: string })?.role ?? userRole;
  const navItems = getMainNavItems(role);

  return (
    <div className="flex min-h-screen min-h-[100dvh]">
      <Sidebar />
      <NavDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        items={navItems}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <HeaderBar
          unread={unread}
          name={userName}
          role={userRole}
          imageUrl={userImageUrl}
          onMenuClick={() => setDrawerOpen(true)}
        />
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
