"use client";

import { addExamQuestion } from "@/lib/actions/admin";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function AddQuestionForm({ examId }: { examId: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [opts, setOpts] = useState([
    { text: "", isCorrect: true },
    { text: "", isCorrect: false },
    { text: "", isCorrect: false },
  ]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await addExamQuestion(examId, text, opts.filter((o) => o.text.trim()));
    setText("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border bg-white p-4">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Question text"
        required
        className="w-full rounded border px-3 py-2"
      />
      {opts.map((o, i) => (
        <div key={i} className="flex gap-2">
          <input
            type="radio"
            name="correct"
            checked={o.isCorrect}
            onChange={() =>
              setOpts(opts.map((x, j) => ({ ...x, isCorrect: j === i })))
            }
          />
          <input
            value={o.text}
            onChange={(e) => {
              const next = [...opts];
              next[i] = { ...next[i], text: e.target.value };
              setOpts(next);
            }}
            placeholder={`Option ${i + 1}`}
            className="flex-1 rounded border px-2 py-1"
          />
        </div>
      ))}
      <button type="submit" className="rounded-lg bg-storm-medium-blue px-4 py-2 text-sm text-white">
        Add question
      </button>
    </form>
  );
}
