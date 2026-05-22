import Link from "next/link";
import { requireAdmin } from "@/lib/auth-utils";

const adminNav = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/courses", label: "Courses" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/certifications", label: "Certifications" },
  { href: "/admin/media", label: "Media" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-2 border-b border-storm-light-blue/60 pb-4">
        {adminNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-storm-navy no-underline hover:bg-storm-light-blue/40"
          >
            {item.label}
          </Link>
        ))}
      </div>
      {children}
    </div>
  );
}
