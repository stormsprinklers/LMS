/** Normalized exam question shape from AI (blueprint-compatible types). */
export type RepairedExamQuestion = {
  type: "MULTIPLE_CHOICE" | "MULTI_SELECT" | "TRUE_FALSE";
  text: string;
  options: { text: string; isCorrect: boolean }[];
};

export function repairExamQuestions(raw: unknown[]): RepairedExamQuestion[] {
  return raw.map((entry, qi) => {
    if (!entry || typeof entry !== "object") {
      return fallbackQuestion(qi);
    }
    const q = entry as Record<string, unknown>;
    let type = String(q.type ?? "MULTIPLE_CHOICE");
    if (type === "MULTIPLE_SELECT") type = "MULTI_SELECT";
    if (
      type !== "MULTIPLE_CHOICE" &&
      type !== "MULTI_SELECT" &&
      type !== "TRUE_FALSE"
    ) {
      type = "MULTIPLE_CHOICE";
    }

    let text = String(q.text ?? "").trim();
    if (!text) text = `Question ${qi + 1}`;

    let options: { text: string; isCorrect: boolean }[] = Array.isArray(q.options)
      ? (q.options as unknown[]).map((o, oi) => {
          if (o && typeof o === "object") {
            const row = o as Record<string, unknown>;
            return {
              text: String(row.text ?? "").trim() || `Option ${oi + 1}`,
              isCorrect: row.isCorrect === true,
            };
          }
          return { text: String(o), isCorrect: false };
        })
      : [];

    if (type === "TRUE_FALSE") {
      if (options.length < 2) {
        options = [
          { text: "True", isCorrect: true },
          { text: "False", isCorrect: false },
        ];
      } else {
        options = options.slice(0, 2).map((o, i) => ({
          text: i === 0 ? "True" : "False",
          isCorrect: o.isCorrect,
        }));
      }
    } else if (options.length < 2) {
      while (options.length < 4) {
        options.push({
          text: `Option ${String.fromCharCode(65 + options.length)}`,
          isCorrect: options.length === 0,
        });
      }
    }

    options = options.map((o, oi) => ({
      text:
        o.text.trim() ||
        (type === "TRUE_FALSE"
          ? oi === 0
            ? "True"
            : "False"
          : `Option ${String.fromCharCode(65 + oi)}`),
      isCorrect: o.isCorrect === true,
    }));

    if (!options.some((o) => o.isCorrect)) {
      options[0] = { ...options[0], isCorrect: true };
    }

    if (type === "MULTIPLE_CHOICE" || type === "TRUE_FALSE") {
      let found = false;
      options = options.map((o) => {
        if (o.isCorrect && !found) {
          found = true;
          return o;
        }
        return { ...o, isCorrect: false };
      });
      if (!found && options[0]) {
        options[0] = { ...options[0], isCorrect: true };
      }
    }

    return {
      type: type as RepairedExamQuestion["type"],
      text,
      options,
    };
  });
}

function fallbackQuestion(qi: number): RepairedExamQuestion {
  return {
    type: "MULTIPLE_CHOICE",
    text: `Question ${qi + 1}`,
    options: [
      { text: "Option A", isCorrect: true },
      { text: "Option B", isCorrect: false },
      { text: "Option C", isCorrect: false },
      { text: "Option D", isCorrect: false },
    ],
  };
}

export function validateRepairedExamQuestions(questions: RepairedExamQuestion[]): string[] {
  const issues: string[] = [];
  if (questions.length === 0) {
    issues.push("No questions were generated.");
    return issues;
  }
  questions.forEach((q, qi) => {
    const prefix = `Question ${qi + 1}`;
    if (!q.text.trim()) issues.push(`${prefix}: missing question text.`);
    if (q.options.length < 2) issues.push(`${prefix}: needs at least two options.`);
    if (!q.options.some((o) => o.isCorrect)) {
      issues.push(`${prefix}: mark at least one correct answer.`);
    }
    if (
      (q.type === "MULTIPLE_CHOICE" || q.type === "TRUE_FALSE") &&
      q.options.filter((o) => o.isCorrect).length !== 1
    ) {
      issues.push(`${prefix}: multiple choice needs exactly one correct option.`);
    }
    if (q.type === "MULTI_SELECT" && !q.options.some((o) => o.isCorrect)) {
      issues.push(`${prefix}: select-all needs at least one correct option.`);
    }
  });
  return issues;
}
