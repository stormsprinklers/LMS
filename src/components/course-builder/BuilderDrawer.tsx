"use client";

import { useEffect, useState } from "react";
import { getCourseItemDetail } from "@/lib/repositories/course-builder";
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
  const [itemDetail, setItemDetail] = useState<Awaited<
    ReturnType<typeof getCourseItemDetail>
  > | null>(null);

  useEffect(() => {
    if (selection?.kind === "item") {
      fetch(`/api/admin/course-items/${selection.itemId}`)
        .then((r) => r.json())
        .then(setItemDetail)
        .catch(() => setItemDetail(null));
    } else {
      setItemDetail(null);
    }
  }, [selection]);

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

  return (
    <aside className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-storm-light-blue/60 bg-white shadow-xl lg:static lg:max-h-[calc(100vh-12rem)] lg:rounded-xl lg:border lg:shadow-none">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="font-medium text-storm-navy">
          {selection.kind === "module" ? "Edit module" : "Edit item"}
        </h3>
        <button type="button" onClick={onClose} className="min-h-10 min-w-10 p-2" aria-label="Close">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {selection.kind === "module" && mod && (
          <ModuleEditor module={mod} courseId={course.id} />
        )}
        {selection.kind === "item" && itemDetail && (
          <>
            {itemDetail.itemType === "LESSON" && (
              <LessonItemEditor item={itemDetail} />
            )}
            {itemDetail.itemType === "VIDEO" && (
              <VideoItemEditor item={itemDetail} />
            )}
            {(itemDetail.itemType === "EXAM" || itemDetail.itemType === "QUIZ") && (
              <ExamItemEditor item={itemDetail} />
            )}
            {itemDetail.itemType === "SKILL_CHECK" && (
              <SkillCheckEditor item={itemDetail} />
            )}
            {itemDetail.itemType === "SCENARIO" && (
              <ScenarioEditor item={itemDetail} />
            )}
          </>
        )}
        {selection.kind === "item" && !itemDetail && (
          <p className="text-sm text-storm-navy/60">Loading…</p>
        )}
      </div>
    </aside>
  );
}
