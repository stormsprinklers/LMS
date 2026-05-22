import type { LucideIcon } from "lucide-react";
import {
  Award,
  BookOpen,
  ClipboardCheck,
  FileText,
  GraduationCap,
  LayoutDashboard,
  PlayCircle,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const learnerNavItems: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/courses", label: "Courses", icon: GraduationCap },
  { href: "/training", label: "Video Training", icon: PlayCircle },
  { href: "/manuals", label: "Manuals", icon: FileText },
  { href: "/exams", label: "Exams", icon: ClipboardCheck },
  { href: "/certifications", label: "Certifications", icon: Award },
];

export const adminNavItem: NavItem = {
  href: "/admin",
  label: "Admin",
  icon: BookOpen,
};

export const gradingNavItem: NavItem = {
  href: "/admin/grading",
  label: "Grading",
  icon: BookOpen,
};

export const adminSubNavItems = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/courses", label: "Courses" },
  { href: "/admin/exams", label: "Exams" },
  { href: "/admin/grading", label: "Grading" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/certifications", label: "Certifications" },
  { href: "/admin/media", label: "Media" },
  { href: "/admin/archived", label: "Archived" },
] as const;

export function getMainNavItems(role?: string): NavItem[] {
  if (role === "ADMIN") {
    return [...learnerNavItems, adminNavItem];
  }
  if (role === "COURSE_ADMIN") {
    return [...learnerNavItems, gradingNavItem];
  }
  return learnerNavItems;
}

export function getAdminSubNav(role?: string) {
  if (role === "ADMIN") return [...adminSubNavItems];
  if (role === "COURSE_ADMIN") {
    return adminSubNavItems.filter((n) => n.href === "/admin/grading");
  }
  return [];
}

export function isNavActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
