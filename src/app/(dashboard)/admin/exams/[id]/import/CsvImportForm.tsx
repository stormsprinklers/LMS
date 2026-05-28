"use client";

import { importQuestionsFromCsv } from "@/lib/actions/exams-admin";
import { parseQuestionsCsv } from "@/lib/exams/csv-import";
import { FileInput } from "@/components/ui/FileInput";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

export function CsvImportForm({ examId }: { examId: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState<{ text: string; type: string }[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [message, setMessage] = useState("");

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCsv(String(reader.result ?? ""));
    reader.readAsText(file);
  }

  function handlePreview() {
    const { questions, errors: errs } = parseQuestionsCsv(csv);
    setErrors(errs);
    setPreview(questions.map((q) => ({ text: q.text, type: q.type })));
  }

  async function handleImport() {
    setMessage("");
    const result = await importQuestionsFromCsv(examId, csv);
    if ("error" in result && result.error) {
      setMessage(result.error);
      return;
    }
    setMessage(`Imported ${result.imported} questions.`);
    router.push(`/admin/exams/${examId}`);
  }

  return (
    <div className="w-full max-w-2xl space-y-4 rounded-xl border bg-white p-4 sm:p-6">
      <div>
        <label className="mb-2 block text-sm font-medium text-storm-navy">
          Upload CSV file
        </label>
        <FileInput
          ref={fileRef}
          accept=".csv,text/csv"
          onChange={handleFile}
        />
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium text-storm-navy">
          Or paste CSV
        </label>
        <textarea
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          rows={10}
          placeholder="Paste CSV content here…"
          className="w-full rounded-lg border border-storm-light-blue/60 px-3 py-2 font-mono text-xs sm:text-sm"
        />
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={handlePreview}
          className="min-h-11 w-full rounded-lg border px-4 py-2 text-sm sm:w-auto"
        >
          Preview
        </button>
        <button
          type="button"
          onClick={handleImport}
          className="min-h-11 w-full rounded-lg bg-storm-medium-blue px-4 py-2 text-sm text-white sm:w-auto"
        >
          Import
        </button>
      </div>
      {errors.length > 0 && (
        <pre className="overflow-x-auto text-sm text-red-600 whitespace-pre-wrap">
          {errors.join("\n")}
        </pre>
      )}
      {preview.length > 0 && (
        <ul className="text-sm space-y-1 break-words">
          {preview.map((q, i) => (
            <li key={i}>{q.type}: {q.text}</li>
          ))}
        </ul>
      )}
      {message && <p className="text-sm break-words">{message}</p>}
    </div>
  );
}
