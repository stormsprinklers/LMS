"use client";

import { updateCourseItem, updateSkillCheck } from "@/lib/actions/course-builder";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useBuilderFormDirty } from "../useBuilderFormDirty";
import type { ContentStatus } from "@prisma/client";

const inputClass =
  "mt-1 w-full min-h-10 rounded-lg border border-storm-light-blue/60 px-3 py-2 text-sm";

type Step = { id: string; text: string; isRequired: boolean; points: number; sortOrder: number };

type Item = {
  id: string;
  title: string;
  isRequired: boolean;
  status: ContentStatus;
  skillCheck: {
    traineeInstructions: string | null;
    evaluatorInstructions: string | null;
    passingRule: string;
    minimumScore: number | null;
    requiresEvaluator: boolean;
    steps: Step[];
  } | null;
};

export function SkillCheckEditor({ item }: { item: Item }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const { markDirty, resolveSave, formDirtyProps } = useBuilderFormDirty(
    `skill-check-${item.id}`,
    formRef,
  );
  const [steps, setSteps] = useState<Step[]>(item.skillCheck?.steps ?? []);
  const [busy, setBusy] = useState(false);

  function addStep() {
    markDirty();
    setSteps((s) => [
      ...s,
      { id: `new-${s.length}`, text: "", isRequired: true, points: 1, sortOrder: s.length },
    ]);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    try {
    await updateCourseItem(item.id, {
      title: String(fd.get("title")),
      isRequired: fd.get("isRequired") === "on",
      status: String(fd.get("status")) as ContentStatus,
    });
    await updateSkillCheck(item.id, {
      traineeInstructions: String(fd.get("traineeInstructions") || ""),
      evaluatorInstructions: String(fd.get("evaluatorInstructions") || ""),
      passingRule: fd.get("passingRule") === "MINIMUM_SCORE" ? "MINIMUM_SCORE" : "ALL_REQUIRED",
      minimumScore: Number(fd.get("minimumScore")) || undefined,
      requiresEvaluator: fd.get("requiresEvaluator") === "on",
      steps: steps.map((s) => ({
        text: s.text,
        isRequired: s.isRequired,
        points: s.points,
      })),
    });
    resolveSave(true);
    router.refresh();
    } catch {
      resolveSave(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} {...formDirtyProps} className="space-y-3">
      <label className="block text-sm">
        Title
        <input name="title" defaultValue={item.title} required className={inputClass} />
      </label>
      <label className="block text-sm">
        Instructions for trainee
        <textarea
          name="traineeInstructions"
          rows={3}
          defaultValue={item.skillCheck?.traineeInstructions ?? ""}
          className={inputClass}
        />
      </label>
      <label className="block text-sm">
        Instructions for evaluator
        <textarea
          name="evaluatorInstructions"
          rows={3}
          defaultValue={item.skillCheck?.evaluatorInstructions ?? ""}
          className={inputClass}
        />
      </label>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Checklist</legend>
        {steps.map((step, i) => (
          <div key={step.id} className="rounded-lg border p-2 space-y-2">
            <input
              value={step.text}
              onChange={(e) => {
                markDirty();
                const next = [...steps];
                next[i] = { ...step, text: e.target.value };
                setSteps(next);
              }}
              placeholder="Step description"
              className={inputClass}
            />
            <div className="flex gap-3 text-xs">
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={step.isRequired}
                  onChange={(e) => {
                    markDirty();
                    const next = [...steps];
                    next[i] = { ...step, isRequired: e.target.checked };
                    setSteps(next);
                  }}
                />
                Required
              </label>
              <label className="flex items-center gap-1">
                Points
                <input
                  type="number"
                  min={0}
                  value={step.points}
                  onChange={(e) => {
                    markDirty();
                    const next = [...steps];
                    next[i] = { ...step, points: Number(e.target.value) };
                    setSteps(next);
                  }}
                  className="w-14 rounded border px-1"
                />
              </label>
            </div>
          </div>
        ))}
        <button type="button" onClick={addStep} className="text-sm text-storm-medium-blue">
          + Add step
        </button>
      </fieldset>
      <label className="block text-sm">
        Passing rule
        <select
          name="passingRule"
          defaultValue={item.skillCheck?.passingRule ?? "ALL_REQUIRED"}
          className={inputClass}
        >
          <option value="ALL_REQUIRED">All required steps passed</option>
          <option value="MINIMUM_SCORE">Minimum rubric score</option>
        </select>
      </label>
      <label className="block text-sm">
        Minimum score
        <input
          name="minimumScore"
          type="number"
          min={0}
          defaultValue={item.skillCheck?.minimumScore ?? ""}
          className={inputClass}
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="requiresEvaluator"
          defaultChecked={item.skillCheck?.requiresEvaluator ?? true}
          className="h-4 w-4"
        />
        Trainer review required
      </label>
      <button
        type="submit"
        disabled={busy}
        className="min-h-10 w-full rounded-lg bg-storm-medium-blue text-sm font-semibold text-white"
      >
        {busy ? "Saving…" : "Save skill check"}
      </button>
    </form>
  );
}
