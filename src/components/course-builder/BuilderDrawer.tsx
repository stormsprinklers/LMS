"use client";

import { useCallback, useEffect, useState } from "react";
import { useCourseBuilderUnsaved } from "./CourseBuilderUnsavedContext";
import type { CourseBuilderCourse } from "@/lib/course-builder/types";
import { ModuleEditor } from "./editors/ModuleEditor";
import { LessonItemEditor } from "./editors/LessonItemEditor";
import { VideoItemEditor } from "./editors/VideoItemEditor";
import { SkillCheckEditor } from "./editors/SkillCheckEditor";
import { ScenarioEditor } from "./editors/ScenarioEditor";
import { ExamItemEditor } from "./editors/ExamItemEditor";
import { X } from "lucide-react";

type Selection =
  | { kind: "module"; moduleId: string }
  | { kind: "item"; itemId: string }
  | null;

export function BuilderDrawer({
  course,
  selection,
  onClose,
}: {
  course: CourseBuilderCourse;
  selection: Selection;
  onClose: () => void;
}) {
  const { confirmNavigation } = useCourseBuilderUnsaved();
  const [itemDetail, setItemDetail] = useState<Record<string, unknown> | null>(null);
  const [loadingItem, setLoadingItem] = useState(false);
  const [fetchError, setFetchError] = useState("");

  const selectedItemId = selection?.kind === "item" ? selection.itemId : null;
  const selectedModuleId = selection?.kind === "module" ? selection.moduleId : null;

  const loadItemDetail = useCallback(async (itemId: string) => {
    setLoadingItem(true);
    setFetchError("");
    try {
      const res = await fetch(`/api/admin/course-items/${itemId}`);
      const data = await res.json();
      if (!res.ok) {
        setItemDetail(null);
        setFetchError(data.error ?? "Could not load item.");
        return;
      }
      setItemDetail(data);
    } catch {
      setItemDetail(null);
      setFetchError("Could not load item.");
    } finally {
      setLoadingItem(false);
    }
  }, []);

  useEffect(() => {
    if (selectedItemId) {
      setItemDetail(null);
      void loadItemDetail(selectedItemId);
    } else {
      setItemDetail(null);
      setFetchError("");
      setLoadingItem(false);
    }
  }, [selectedItemId, loadItemDetail]);

  if (!selection) {
    return (
      <aside className="hidden w-96 shrink-0 rounded-xl border border-dashed border-storm-light-blue/60 bg-storm-light-grey/20 p-6 lg:block">
        <p className="text-sm text-storm-navy/60">
          Select a module or lesson to edit its details.
        </p>
      </aside>
    );
  }

  const mod =
    selection.kind === "module"
      ? course.modules.find((m) => m.id === selection.moduleId)
      : null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const detail = itemDetail as any;

  return (
    <aside className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-storm-light-blue/60 bg-white shadow-xl lg:static lg:max-h-[calc(100vh-12rem)] lg:rounded-xl lg:border lg:shadow-none">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="font-medium text-storm-navy">
          {selection.kind === "module" ? "Edit module" : "Edit item"}
        </h3>
        <button
          type="button"
          onClick={() => confirmNavigation(onClose)}
          className="min-h-10 min-w-10 p-2"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {selection.kind === "module" && mod && (
          <ModuleEditor key={selectedModuleId} module={mod} courseId={course.id} />
        )}
        {selection.kind === "item" && loadingItem && (
          <p className="text-sm text-storm-navy/60">Loading…</p>
        )}
        {selection.kind === "item" && fetchError && (
          <p className="text-sm text-red-600">{fetchError}</p>
        )}
        {selection.kind === "item" && detail && !loadingItem && (
          <>
            {detail.itemType === "LESSON" && (
              <LessonItemEditor
                key={detail.id as string}
                item={detail}
                onSaved={() => void loadItemDetail(detail.id as string)}
              />
            )}
            {detail.itemType === "VIDEO" && (
              <VideoItemEditor key={detail.id as string} item={detail} />
            )}
            {(detail.itemType === "EXAM" || detail.itemType === "QUIZ") && (
              <ExamItemEditor key={detail.id as string} item={detail} />
            )}
            {detail.itemType === "SKILL_CHECK" && (
              <SkillCheckEditor key={detail.id as string} item={detail} />
            )}
            {detail.itemType === "SCENARIO" && (
              <ScenarioEditor key={detail.id as string} item={detail} />
            )}
          </>
        )}
      </div>
    </aside>
  );
}
