import type { QuestionType } from "@prisma/client";
import type { QuestionInput } from "./types";

export const CSV_HEADERS = [
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

/** Shown in admin UI; must match CSV_HEADERS order. */
export const CSV_COLUMN_GUIDE: { column: string; description: string }[] = [
  {
    column: "question_type",
    description:
      "Required. MULTIPLE_CHOICE | MULTIPLE_SELECT | FREE_RESPONSE | SLIDER | MATCHING",
  },
  { column: "question_text", description: "Required. The question prompt shown to learners." },
  {
    column: "sort_order",
    description: "Optional. Display order (0, 1, 2…). Defaults to row order if blank.",
  },
  {
    column: "option_a … option_d",
    description: "For MC / multi-select only. Answer choices A–D (use at least 2).",
  },
  {
    column: "correct_options",
    description:
      "For MC / multi-select. Letters of correct answers: A, D, or A|C for multiple.",
  },
  {
    column: "slider_min / slider_max",
    description: "For SLIDER only. Numeric range for the slider control.",
  },
  {
    column: "slider_correct",
    description: "For SLIDER only. The correct value learners should select.",
  },
  {
    column: "slider_tolerance",
    description: "For SLIDER only. Allowed deviation from correct (e.g. 2 = ±2).",
  },
  {
    column: "matching_pairs",
    description:
      'For MATCHING only. Pairs as Left:Right separated by semicolons, e.g. "Valve:Flow;Head:Spray".',
  },
  {
    column: "free_response_max_length",
    description: "For FREE_RESPONSE only. Optional character limit for the text box.",
  },
];

function quoteCsv(value: string) {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function commentRow(text: string) {
  return `#,${quoteCsv(text)}`;
}

export function getCsvTemplateContent() {
  const rows: string[] = [
    CSV_HEADERS.join(","),
    commentRow("INSTRUCTIONS — Delete every row whose question_type starts with # before importing."),
    commentRow("One question per row. Leave unused columns empty for that question type."),
    commentRow(""),
    commentRow("COLUMN: question_type — MULTIPLE_CHOICE | MULTIPLE_SELECT | FREE_RESPONSE | SLIDER | MATCHING"),
    commentRow("COLUMN: question_text — Required prompt text"),
    commentRow("COLUMN: sort_order — 0-based order (0 first); optional"),
    commentRow("COLUMN: option_a … option_d — MC / multi-select answer choices"),
    commentRow("COLUMN: correct_options — Single letter (D) or pipe-separated (A|C) for multi-select"),
    commentRow("COLUMN: slider_min, slider_max, slider_correct, slider_tolerance — SLIDER only"),
    commentRow('COLUMN: matching_pairs — MATCHING only. Format: "Left1:Right1;Left2:Right2" (min 2 pairs)'),
    commentRow("COLUMN: free_response_max_length — FREE_RESPONSE only. Optional max characters"),
    commentRow(""),
    commentRow("EXAMPLES BELOW — Copy and edit, or replace with your own questions"),
    [
      "MULTIPLE_CHOICE",
      quoteCsv("What is the primary purpose of a backflow preventer?"),
      "0",
      quoteCsv("Decorative lighting"),
      quoteCsv("Prevent contaminated water entering the supply"),
      quoteCsv("Increase water pressure"),
      quoteCsv("Filter sediment only"),
      "B",
      "",
      "",
      "",
      "",
      "",
      "",
    ].join(","),
    [
      "MULTIPLE_SELECT",
      quoteCsv("Which are common irrigation head types? (select all that apply)"),
      "1",
      quoteCsv("Rotor"),
      quoteCsv("Spray"),
      quoteCsv("Drip emitter"),
      quoteCsv("Smoke detector"),
      "A|B|C",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ].join(","),
    [
      "FREE_RESPONSE",
      quoteCsv("Describe how you would locate a zone valve failure in the field."),
      "2",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "1000",
    ].join(","),
    [
      "SLIDER",
      quoteCsv("Set the recommended operating pressure (PSI) for a typical residential zone."),
      "3",
      "",
      "",
      "",
      "",
      "",
      "20",
      "80",
      "45",
      "3",
      "",
      "",
    ].join(","),
    [
      "MATCHING",
      quoteCsv("Match each component to its function."),
      "4",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      quoteCsv("Zone valve:Controls water to a zone;Controller:Schedules run times;Rain sensor:Stops watering when wet"),
      "",
    ].join(","),
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

function isSkippableRow(typeRaw: string, text: string) {
  if (!typeRaw) return true;
  if (typeRaw.startsWith("#")) return true;
  if (typeRaw === "INSTRUCTIONS" || typeRaw === "COLUMN" || typeRaw === "EXAMPLE") {
    return true;
  }
  if (!text && !["MULTIPLE_CHOICE", "MULTIPLE_SELECT", "FREE_RESPONSE", "SLIDER", "MATCHING"].includes(typeRaw)) {
    return true;
  }
  return false;
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
    return { questions: [], errors: ["CSV must include header and at least one question row"] };
  }

  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/^\uFEFF/, ""));
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

    if (isSkippableRow(typeRaw, text)) continue;

    if (!text) {
      errors.push(`Line ${lineNum}: question_text is required`);
      continue;
    }

    const sortOrder = parseInt(col(row, "sort_order") || String(questions.length), 10);

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

function buildQuestionRow(
  q: {
    type: QuestionType;
    text: string;
    sortOrder: number;
    config: unknown;
    options: { text: string; isCorrect: boolean; sortOrder: number }[];
  },
) {
  const opts = [...q.options].sort((a, b) => a.sortOrder - b.sortOrder);
  const letters = ["a", "b", "c", "d"];
  const correct = opts
    .map((o, i) => (o.isCorrect ? letters[i]?.toUpperCase() : null))
    .filter(Boolean)
    .join("|");

  const cfg = q.config as Record<string, unknown> | null;
  const cells: string[] = [
    q.type,
    quoteCsv(q.text),
    String(q.sortOrder),
    opts[0] ? quoteCsv(opts[0].text) : "",
    opts[1] ? quoteCsv(opts[1].text) : "",
    opts[2] ? quoteCsv(opts[2].text) : "",
    opts[3] ? quoteCsv(opts[3].text) : "",
    correct,
    "",
    "",
    "",
    "",
    "",
    "",
  ];

  if (q.type === "SLIDER" && cfg) {
    cells[8] = String(cfg.min ?? "");
    cells[9] = String(cfg.max ?? "");
    cells[10] = String(cfg.correctValue ?? "");
    cells[11] = String(cfg.tolerance ?? "");
  } else if (q.type === "MATCHING" && cfg?.pairs) {
    const pairs = (cfg.pairs as { left: string; right: string }[])
      .map((p) => `${p.left}:${p.right}`)
      .join(";");
    cells[12] = quoteCsv(pairs);
  } else if (q.type === "FREE_RESPONSE" && cfg?.maxLength) {
    cells[13] = String(cfg.maxLength);
  }

  return cells.join(",");
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
  return [CSV_HEADERS.join(","), ...questions.map(buildQuestionRow)].join("\n");
}
