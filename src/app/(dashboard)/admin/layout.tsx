import { AdminSubNav } from "@/components/layout/AdminSubNav";
import { requireAdminOrCourseAdmin } from "@/lib/auth-utils";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdminOrCourseAdmin();

  return (
    <div className="min-w-0">
      <AdminSubNav />
      {children}
    </div>
  );
}
