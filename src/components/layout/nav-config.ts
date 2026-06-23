import type { LucideIcon } from "lucide-react";
import {
  Award,
  BookOpen,
  ClipboardCheck,
  FolderOpen,
  GraduationCap,
  LayoutDashboard,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const learnerNavItems: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/courses", label: "Courses", icon: GraduationCap },
  { href: "/library", label: "Library", icon: FolderOpen },
  { href: "/exams", label: "Exams", icon: ClipboardCheck },
  { href: "/certifications", label: "Certifications", icon: Award },
];

export const adminNavItem: NavItem = {
  href: "/admin",
  label: "Admin",
  icon: BookOpen,
};

export const gradingNavItem: NavItem = {
  href: "/admin/grades?view=pending",
  label: "Grades",
  icon: BookOpen,
};

export function getExternalCrmUrl(role?: string): string | null {
  if (role !== "ADMIN" && role !== "MANAGER") return null;
  const url = process.env.NEXT_PUBLIC_CRM_URL?.trim();
  return url ? `${url.replace(/\/$/, "")}/settings/employees` : null;
}

export const adminSubNavItems = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/courses", label: "Courses" },
  { href: "/admin/exams", label: "Exams" },
  { href: "/admin/grades", label: "Grades" },
  { href: "/admin/skill-checks", label: "Skill Checks" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/certifications", label: "Certifications" },
  { href: "/library", label: "Library" },
  { href: "/admin/archived", label: "Archived" },
] as const;

const managerSubNavItems = [
  { href: "/admin/courses", label: "Courses" },
  { href: "/admin/exams", label: "Exams" },
  { href: "/admin/grades", label: "Grades" },
] as const;

export function getMainNavItems(role?: string): NavItem[] {
  if (role === "ADMIN" || role === "MANAGER") {
    return [...learnerNavItems, adminNavItem];
  }
  if (role === "COURSE_ADMIN") {
    return [...learnerNavItems, gradingNavItem];
  }
  return learnerNavItems;
}

export function getAdminSubNav(role?: string) {
  if (role === "ADMIN") return [...adminSubNavItems];
  if (role === "MANAGER") return [...managerSubNavItems];
  if (role === "COURSE_ADMIN") {
    return adminSubNavItems.filter((n) => n.href === "/admin/grades");
  }
  return [];
}

export function isNavActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/admin/grades") {
    return (
      pathname === "/admin/grades" ||
      pathname.startsWith("/admin/grades/") ||
      pathname.startsWith("/admin/grading/")
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
