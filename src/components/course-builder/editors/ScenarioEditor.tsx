"use client";

import { updateCourseItem, updateScenario } from "@/lib/actions/course-builder";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ContentStatus } from "@prisma/client";

const inputClass =
  "mt-1 w-full min-h-10 rounded-lg border border-storm-light-blue/60 px-3 py-2 text-sm";

type Item = {
  id: string;
  title: string;
  isRequired: boolean;
  status: ContentStatus;
  scenario: {
    prompt: string;
    backgroundInfo: string | null;
    difficulty: string | null;
    category: string | null;
  } | null;
};

export function ScenarioEditor({ item }: { item: Item }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    await updateCourseItem(item.id, {
      title: String(fd.get("title")),
      isRequired: fd.get("isRequired") === "on",
      status: String(fd.get("status")) as ContentStatus,
    });
    await updateScenario(item.id, {
      prompt: String(fd.get("prompt")),
      backgroundInfo: String(fd.get("backgroundInfo") || "") || undefined,
      difficulty: String(fd.get("difficulty") || "") || undefined,
      category: String(fd.get("category") || "") || undefined,
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <label className="block text-sm">
        Title
        <input name="title" defaultValue={item.title} required className={inputClass} />
      </label>
      <label className="block text-sm">
        Scenario prompt
        <textarea
          name="prompt"
          rows={4}
          required
          defaultValue={item.scenario?.prompt ?? ""}
          className={inputClass}
        />
      </label>
      <label className="block text-sm">
        Background info
        <textarea
          name="backgroundInfo"
          rows={3}
          defaultValue={item.scenario?.backgroundInfo ?? ""}
          className={inputClass}
        />
      </label>
      <label className="block text-sm">
        Difficulty
        <select name="difficulty" defaultValue={item.scenario?.difficulty ?? ""} className={inputClass}>
          <option value="">—</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
      </label>
      <label className="block text-sm">
        Category
        <input name="category" defaultValue={item.scenario?.category ?? ""} className={inputClass} />
      </label>
      <p className="text-xs text-storm-navy/60">
        Branching scenarios are planned for a later release. MVP uses prompt + optional linked exam.
      </p>
      <button
        type="submit"
        disabled={busy}
        className="min-h-10 w-full rounded-lg bg-storm-medium-blue text-sm font-semibold text-white"
      >
        {busy ? "Saving…" : "Save scenario"}
      </button>
    </form>
  );
}
