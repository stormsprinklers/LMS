import type { QuestionType } from "@prisma/client";
import type { QuestionInput } from "./types";

const HEADERS = [
  "question_type",
  "question_text",
  "sort_order",
  "option_a",
  "option_b",
  "option_c",
  "option_d",
  "correct_options",
  "slider_min",
  "slider_max",
  "slider_correct",
  "slider_tolerance",
  "matching_pairs",
  "free_response_max_length",
] as const;

export function getCsvTemplateContent() {
  const rows = [
    HEADERS.join(","),
    'MULTIPLE_CHOICE,"What is 2+2?",0,2,3,4,5,D,,,,,,,',
    'MULTIPLE_SELECT,"Select prime numbers",1,2,3,4,5,B|D,,,,,,,',
    'FREE_RESPONSE,"Describe backflow prevention",2,,,,,,,,,,,500',
    'SLIDER,"Set pressure to 40 PSI",3,,,,,,10,80,40,2,,',
    'MATCHING,"Match terms",4,,,,,,,,,,"Valve:Controls flow;Head:Distributes water",',
  ];
  return rows.join("\n");
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += c;
    }
  }
  result.push(current.trim());
  return result;
}

function col(row: Record<string, string>, key: string) {
  return (row[key] ?? "").trim();
}

function parseMatchingPairs(raw: string) {
  return raw
    .split(";")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((pair) => {
      const [left, right] = pair.split(":").map((s) => s.trim());
      return { left: left ?? "", right: right ?? "" };
    })
    .filter((p) => p.left && p.right);
}

function parseOptions(row: Record<string, string>) {
  const letters = ["a", "b", "c", "d"] as const;
  const opts: { letter: string; text: string }[] = [];
  for (const l of letters) {
    const t = col(row, `option_${l}`);
    if (t) opts.push({ letter: l.toUpperCase(), text: t });
  }
  return opts;
}

export function parseQuestionsCsv(csvText: string): {
  questions: QuestionInput[];
  errors: string[];
} {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2) {
    return { questions: [], errors: ["CSV must include header and at least one row"] };
  }

  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const errors: string[] = [];
  const questions: QuestionInput[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const row: Record<string, string> = {};
    header.forEach((h, idx) => {
      row[h] = values[idx] ?? "";
    });

    const lineNum = i + 1;
    const typeRaw = col(row, "question_type").toUpperCase();
    const text = col(row, "question_text");
    if (!text) {
      errors.push(`Line ${lineNum}: question_text is required`);
      continue;
    }

    const sortOrder = parseInt(col(row, "sort_order") || String(i - 1), 10) || i - 1;

    if (
      ![
        "MULTIPLE_CHOICE",
        "MULTIPLE_SELECT",
        "FREE_RESPONSE",
        "SLIDER",
        "MATCHING",
      ].includes(typeRaw)
    ) {
      errors.push(`Line ${lineNum}: invalid question_type "${typeRaw}"`);
      continue;
    }

    const type = typeRaw as QuestionType;

    if (type === "MULTIPLE_CHOICE" || type === "MULTIPLE_SELECT") {
      const opts = parseOptions(row);
      if (opts.length < 2) {
        errors.push(`Line ${lineNum}: need at least 2 options`);
        continue;
      }
      const correctLetters = col(row, "correct_options")
        .toUpperCase()
        .split("|")
        .map((s) => s.trim())
        .filter(Boolean);
      if (correctLetters.length === 0) {
        errors.push(`Line ${lineNum}: correct_options required`);
        continue;
      }
      if (type === "MULTIPLE_CHOICE" && correctLetters.length !== 1) {
        errors.push(`Line ${lineNum}: MC needs exactly one correct option`);
        continue;
      }
      questions.push({
        type,
        text,
        sortOrder,
        options: opts.map((o) => ({
          text: o.text,
          isCorrect: correctLetters.includes(o.letter),
        })),
      });
    } else if (type === "FREE_RESPONSE") {
      const maxLen = col(row, "free_response_max_length");
      questions.push({
        type,
        text,
        sortOrder,
        config: maxLen ? { maxLength: parseInt(maxLen, 10) } : {},
      });
    } else if (type === "SLIDER") {
      const min = parseFloat(col(row, "slider_min"));
      const max = parseFloat(col(row, "slider_max"));
      const correct = parseFloat(col(row, "slider_correct"));
      const tolerance = parseFloat(col(row, "slider_tolerance") || "0");
      if (Number.isNaN(min) || Number.isNaN(max) || Number.isNaN(correct)) {
        errors.push(`Line ${lineNum}: slider min/max/correct required`);
        continue;
      }
      questions.push({
        type,
        text,
        sortOrder,
        config: { min, max, step: 1, correctValue: correct, tolerance },
      });
    } else if (type === "MATCHING") {
      const pairs = parseMatchingPairs(col(row, "matching_pairs"));
      if (pairs.length < 2) {
        errors.push(`Line ${lineNum}: matching_pairs need at least 2 pairs`);
        continue;
      }
      questions.push({ type, text, sortOrder, config: { pairs } });
    }
  }

  if (questions.length > 200) {
    errors.push("Maximum 200 questions per import");
    return { questions: [], errors };
  }

  return { questions, errors };
}

export function questionsToCsv(
  questions: {
    type: QuestionType;
    text: string;
    sortOrder: number;
    config: unknown;
    options: { text: string; isCorrect: boolean; sortOrder: number }[];
  }[],
) {
  const rows = [HEADERS.join(",")];
  for (const q of questions) {
    const opts = [...q.options].sort((a, b) => a.sortOrder - b.sortOrder);
    const letters = ["a", "b", "c", "d"];
    const row: string[] = [];
    row.push(q.type);
    row.push(`"${q.text.replace(/"/g, '""')}"`);
    row.push(String(q.sortOrder));
    for (let i = 0; i < 4; i++) {
      row.push(opts[i] ? `"${opts[i].text.replace(/"/g, '""')}"` : "");
    }
    const correct = opts
      .map((o, i) => (o.isCorrect ? letters[i]?.toUpperCase() : null))
      .filter(Boolean)
      .join("|");
    row.push(correct);
    const cfg = q.config as Record<string, unknown> | null;
    if (q.type === "SLIDER" && cfg) {
      row.push("", "", "", "", correct);
      row.push(String(cfg.min ?? ""));
      row.push(String(cfg.max ?? ""));
      row.push(String(cfg.correctValue ?? ""));
      row.push(String(cfg.tolerance ?? ""));
      row.push("");
      row.push("");
    } else if (q.type === "MATCHING" && cfg?.pairs) {
      const pairs = (cfg.pairs as { left: string; right: string }[])
        .map((p) => `${p.left}:${p.right}`)
        .join(";");
      row.push("", "", "", "", correct, "", "", "", "", pairs, "");
    } else if (q.type === "FREE_RESPONSE" && cfg) {
      row.push("", "", "", "", correct, "", "", "", "", "", String(cfg.maxLength ?? ""));
    } else {
      row.push("", "", "", "", correct, "", "", "", "", "", "");
    }
    rows.push(row.join(","));
  }
  return rows.join("\n");
}
