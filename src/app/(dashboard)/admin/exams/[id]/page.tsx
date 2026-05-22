import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { getExamAdmin, listUsersForAssignment } from "@/lib/actions/exams-admin";
import { ExamDetailClient } from "./ExamDetailClient";

export default async function AdminExamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [exam, users] = await Promise.all([getExamAdmin(id), listUsersForAssignment()]);
  if (!exam) notFound();

  return (
    <>
      <PageHeader
        title={exam.title}
        description={
          exam.archived
            ? `Archived · ${exam.course?.title ?? "Standalone exam"}`
            : exam.course?.title ?? "Standalone exam"
        }
        action={
          <Link href="/admin/exams" className="text-sm text-storm-medium-blue no-underline">
            ← All exams
          </Link>
        }
      />
      <ExamDetailClient exam={exam} allUsers={users} />
    </>
  );
}
