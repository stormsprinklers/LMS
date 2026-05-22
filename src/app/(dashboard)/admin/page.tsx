import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { prisma } from "@/lib/db";
import Link from "next/link";

export const metadata = { title: "Admin" };

export default async function AdminPage() {
  const [courses, users, exams] = await Promise.all([
    prisma.course.count(),
    prisma.user.count(),
    prisma.exam.count(),
  ]);

  return (
    <>
      <PageHeader
        title="Admin"
        description="Manage courses, users, exams, certifications, and media uploads."
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-2xl font-bold text-storm-navy">{courses}</p>
          <p className="text-sm text-storm-navy/60">Courses</p>
          <Link href="/admin/courses" className="mt-2 text-sm text-storm-medium-blue no-underline hover:underline">
            Manage →
          </Link>
        </Card>
        <Card>
          <p className="text-2xl font-bold text-storm-navy">{users}</p>
          <p className="text-sm text-storm-navy/60">Users</p>
          <Link href="/admin/users" className="mt-2 text-sm text-storm-medium-blue no-underline hover:underline">
            Manage →
          </Link>
        </Card>
        <Card>
          <p className="text-2xl font-bold text-storm-navy">{exams}</p>
          <p className="text-sm text-storm-navy/60">Exams</p>
          <Link href="/admin/courses" className="mt-2 text-sm text-storm-medium-blue no-underline hover:underline">
            Edit via courses →
          </Link>
        </Card>
      </div>
    </>
  );
}
