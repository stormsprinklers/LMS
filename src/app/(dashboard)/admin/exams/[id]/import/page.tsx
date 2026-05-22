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
        description="Upload a CSV file. Download the template for column format."
      />
      <p className="mb-4">
        <a href="/api/admin/exams/csv-template" className="text-sm text-storm-medium-blue">
          Download CSV template
        </a>
        {" · "}
        <Link href={`/admin/exams/${id}`} className="text-sm text-storm-medium-blue no-underline">
          Back to exam
        </Link>
      </p>
      <CsvImportForm examId={id} />
    </>
  );
}
