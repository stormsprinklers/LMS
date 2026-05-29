"use client";

import { updateModule } from "@/lib/actions/course-builder";
import type { CourseBuilderModule } from "@/lib/course-builder/types";
import type { ContentStatus, ModuleUnlockRule } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useBuilderFormDirty } from "../useBuilderFormDirty";

const inputClass =
  "mt-1 w-full min-h-10 rounded-lg border border-storm-light-blue/60 px-3 py-2 text-sm";

export function ModuleEditor({
  module: mod,
  courseId,
}: {
  module: CourseBuilderModule;
  courseId: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const { resolveSave, formDirtyProps } = useBuilderFormDirty(`module-${mod.id}`, formRef);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    try {
      await updateModule(mod.id, {
        title: String(fd.get("title")),
        description: String(fd.get("description") || "") || undefined,
        estimatedMinutes: Number(fd.get("estimatedMinutes")) || undefined,
        isRequired: fd.get("isRequired") === "on",
        unlockRule: String(fd.get("unlockRule")) as ModuleUnlockRule,
        status: String(fd.get("status")) as ContentStatus,
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
        <input name="title" defaultValue={mod.title} required className={inputClass} />
      </label>
      <label className="block text-sm">
        Description
        <textarea
          name="description"
          rows={3}
          defaultValue={mod.description ?? ""}
          className={inputClass}
        />
      </label>
      <label className="block text-sm">
        Estimated minutes
        <input
          name="estimatedMinutes"
          type="number"
          min={0}
          defaultValue={mod.estimatedMinutes ?? ""}
          className={inputClass}
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isRequired" defaultChecked={mod.isRequired} className="h-4 w-4" />
        Required for completion
      </label>
      <label className="block text-sm">
        Unlock rule
        <select name="unlockRule" defaultValue={mod.unlockRule} className={inputClass}>
          <option value="ALWAYS">Always available</option>
          <option value="PREVIOUS_MODULE_COMPLETE">After previous module completed</option>
          <option value="QUIZ_PASSED">After passing a quiz</option>
          <option value="MANUAL">Manually unlocked by trainer</option>
        </select>
      </label>
      <label className="block text-sm">
        Status
        <select name="status" defaultValue={mod.status} className={inputClass}>
          <option value="DRAFT">Draft</option>
          <option value="READY">Ready</option>
          <option value="PUBLISHED">Published</option>
        </select>
      </label>
      <button
        type="submit"
        disabled={busy}
        className="min-h-10 w-full rounded-lg bg-storm-medium-blue text-sm font-semibold text-white disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save module"}
      </button>
    </form>
  );
}
