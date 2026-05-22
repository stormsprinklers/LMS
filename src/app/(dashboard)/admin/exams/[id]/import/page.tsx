import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { getExamAdmin } from "@/lib/actions/exams-admin";
import { CsvImportForm } from "./CsvImportForm";

export default async function ExamImportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const exam = await getExamAdmin(id);
  if (!exam) notFound();

  return (
    <>
      <PageHeader
        title={`Import questions — ${exam.title}`}
        description="Upload or paste a CSV. Rows starting with # in question_type are ignored (instructions in the template)."
        action={
          <Link
            href={`/admin/exams/${id}`}
            className="text-sm font-medium text-storm-medium-blue no-underline"
          >
            ← Back to exam
          </Link>
        }
      />
      <p className="mb-4 flex flex-col gap-2 sm:flex-row sm:gap-4">
        <a
          href="/api/admin/exams/csv-template"
          className="min-h-11 text-sm font-medium text-storm-medium-blue"
          download
        >
          Download template
        </a>
        <a
          href={`/api/admin/exams/${id}/export`}
          className="min-h-11 text-sm font-medium text-storm-medium-blue"
        >
          Export current questions
        </a>
      </p>
      <CsvImportForm examId={id} />
    </>
  );
}
