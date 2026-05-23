import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { isAdmin, isManager } from "@/lib/auth/permissions";
import { requireStaff } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";
import Link from "next/link";

export const metadata = { title: "Admin" };

export default async function AdminPage() {
  const session = await requireStaff();
  const role = (session.user as { role?: string }).role;
  const manager = isManager(role);

  const courseWhere = manager
    ? { archived: false, createdById: session.user.id }
    : { archived: false };
  const examWhere = manager
    ? { archived: false, createdById: session.user.id }
    : { archived: false };

  const [courses, exams, users] = await Promise.all([
    prisma.course.count({ where: courseWhere }),
    prisma.exam.count({ where: examWhere }),
    isAdmin(role) ? prisma.user.count({ where: { archived: false } }) : Promise.resolve(0),
  ]);

  return (
    <>
      <PageHeader
        title={manager ? "Content management" : "Admin"}
        description={
          manager
            ? "Create and manage your courses and exams."
            : "Manage courses, users, exams, certifications, and media uploads."
        }
      />
      <div className={`grid gap-4 ${isAdmin(role) ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        <Card>
          <p className="text-2xl font-bold text-storm-navy">{courses}</p>
          <p className="text-sm text-storm-navy/60">
            {manager ? "Your courses" : "Courses"}
          </p>
          <Link
            href="/admin/courses"
            className="mt-2 text-sm text-storm-medium-blue no-underline hover:underline"
          >
            Manage →
          </Link>
        </Card>
        <Card>
          <p className="text-2xl font-bold text-storm-navy">{exams}</p>
          <p className="text-sm text-storm-navy/60">
            {manager ? "Your exams" : "Exams"}
          </p>
          <Link
            href="/admin/exams"
            className="mt-2 text-sm text-storm-medium-blue no-underline hover:underline"
          >
            Manage →
          </Link>
        </Card>
        {isAdmin(role) && (
          <Card>
            <p className="text-2xl font-bold text-storm-navy">{users}</p>
            <p className="text-sm text-storm-navy/60">Users</p>
            <Link
              href="/admin/users"
              className="mt-2 text-sm text-storm-medium-blue no-underline hover:underline"
            >
              Manage →
            </Link>
          </Card>
        )}
      </div>
    </>
  );
}
