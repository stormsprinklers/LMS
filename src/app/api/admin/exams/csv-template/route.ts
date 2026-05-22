import { getCsvTemplateContent } from "@/lib/exams/csv-import";

export async function GET() {
  const content = getCsvTemplateContent();
  return new Response(content, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition":
        'attachment; filename="exam-questions-template.csv"',
    },
  });
}
