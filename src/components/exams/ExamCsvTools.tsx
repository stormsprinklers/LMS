"use client";

import Link from "next/link";
import { Download, FileDown, Upload } from "lucide-react";
import { CSV_COLUMN_GUIDE } from "@/lib/exams/csv-import";

const btnClass =
  "flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-storm-light-blue/60 bg-white px-4 py-2.5 text-sm font-medium text-storm-navy no-underline transition-colors hover:bg-storm-light-grey/50 sm:flex-initial sm:min-w-[10rem]";

export function ExamCsvTools({ examId }: { examId: string }) {
  return (
    <div className="rounded-xl border border-storm-light-blue/60 bg-storm-light-grey/30 p-4 sm:p-5 space-y-4">
      <div>
        <h3 className="font-medium text-storm-navy">Questions (CSV)</h3>
        <p className="mt-1 text-sm text-storm-navy/70">
          Bulk add or edit questions. Download the template first — it includes column
          instructions and one example per question type.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <a href="/api/admin/exams/csv-template" className={btnClass} download>
          <Download className="h-4 w-4 shrink-0" aria-hidden />
          Download template
        </a>
        <a href={`/api/admin/exams/${examId}/export`} className={btnClass}>
          <FileDown className="h-4 w-4 shrink-0" aria-hidden />
          Export CSV
        </a>
        <Link href={`/admin/exams/${examId}/import`} className={btnClass}>
          <Upload className="h-4 w-4 shrink-0" aria-hidden />
          Import CSV
        </Link>
      </div>

      <details className="text-sm text-storm-navy/80">
        <summary className="cursor-pointer font-medium text-storm-navy">
          Column reference
        </summary>
        <ul className="mt-3 space-y-2 border-t border-storm-light-blue/40 pt-3">
          {CSV_COLUMN_GUIDE.map((g) => (
            <li key={g.column}>
              <span className="font-mono text-xs text-storm-medium-blue">{g.column}</span>
              <span className="text-storm-navy/70"> — {g.description}</span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
