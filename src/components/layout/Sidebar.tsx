"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Award,
  BookOpen,
  ClipboardCheck,
  FileText,
  GraduationCap,
  LayoutDashboard,
  PlayCircle,
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/courses", label: "Courses", icon: GraduationCap },
  { href: "/training", label: "Video Training", icon: PlayCircle },
  { href: "/manuals", label: "Manuals", icon: FileText },
  { href: "/exams", label: "Exams", icon: ClipboardCheck },
  { href: "/certifications", label: "Certifications", icon: Award },
];

const adminNav = { href: "/admin", label: "Admin", icon: BookOpen };

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin = (session?.user as { role?: string })?.role === "ADMIN";
  const items = isAdmin ? [...navItems, adminNav] : navItems;

  return (
    <aside className="flex w-64 shrink-0 flex-col bg-storm-navy text-white">
      <div className="border-b border-white/10 px-5 py-6">
        <Link href="/" className="no-underline">
          <Logo width={52} height={52} priority showText className="text-white" />
        </Link>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {items.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/"
              ? pathname === "/"
              : pathname === href || pathname.startsWith(`${href}/`);

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors no-underline",
                active
                  ? "bg-storm-medium-blue text-white"
                  : "text-storm-light-blue hover:bg-white/10 hover:text-white",
              )}
            >
              <Icon className="h-5 w-5 shrink-0" aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 px-5 py-4 text-xs text-storm-light-blue">
        <p>Storm Sprinklers LMS</p>
        <p className="mt-1 opacity-70">Internal use only</p>
      </div>
    </aside>
  );
}
