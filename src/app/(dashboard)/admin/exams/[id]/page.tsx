import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { prisma } from "@/lib/db";
import { AddQuestionForm } from "./AddQuestionForm";

export default async function AdminExamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const exam = await prisma.exam.findUnique({
    where: { id },
    include: {
      questions: {
        orderBy: { sortOrder: "asc" },
        include: { options: true },
      },
    },
  });
  if (!exam) notFound();

  return (
    <>
      <PageHeader title={exam.title} description="Add multiple-choice questions." />
      <AddQuestionForm examId={exam.id} />
      <ul className="mt-8 space-y-4">
        {exam.questions.map((q, i) => (
          <li key={q.id} className="rounded-xl border bg-white p-4">
            <p className="font-medium text-storm-navy">
              {i + 1}. {q.text}
            </p>
            <ul className="mt-2 text-sm text-storm-navy/70">
              {q.options.map((o) => (
                <li key={o.id}>
                  {o.isCorrect ? "✓ " : ""}
                  {o.text}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </>
  );
}
