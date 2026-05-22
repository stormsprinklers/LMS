"use client";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createCourseItem,
  createModule,
  reorderCurriculum,
  duplicateCourseItem,
  archiveCourseItem,
} from "@/lib/actions/course-builder";
import type { CourseBuilderCourse, CourseBuilderItem } from "@/lib/course-builder/types";
import { ITEM_TYPE_LABELS, TRACK_LABELS } from "@/lib/course-builder/types";
import { AddContentPicker } from "../AddContentPicker";
import { BuilderDrawer } from "../BuilderDrawer";
import { ItemTypeIcon } from "../ItemTypeIcon";
import type { CourseItemTrack, CourseItemType } from "@prisma/client";
import { GripVertical, Plus, ChevronDown, ChevronRight } from "lucide-react";

export function CurriculumTab({ course }: { course: CourseBuilderCourse }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<Record<string, boolean>>(
    Object.fromEntries(course.modules.map((m) => [m.id, true])),
  );
  const [pickerModuleId, setPickerModuleId] = useState<string | null>(null);
  const [selection, setSelection] = useState<
    | { kind: "module"; moduleId: string }
    | { kind: "item"; itemId: string }
    | null
  >(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function handleModuleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = course.modules.map((m) => m.id);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    const newOrder = arrayMove(ids, oldIndex, newIndex);
    const itemOrders: Record<string, string[]> = {};
    for (const m of course.modules) {
      itemOrders[m.id] = m.items.map((i) => i.id);
    }
    await reorderCurriculum(course.id, newOrder, itemOrders);
    router.refresh();
  }

  async function handleItemDragEnd(moduleId: string, event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const mod = course.modules.find((m) => m.id === moduleId);
    if (!mod) return;
    const ids = mod.items.map((i) => i.id);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    const newIds = arrayMove(ids, oldIndex, newIndex);
    const itemOrders: Record<string, string[]> = {};
    for (const m of course.modules) {
      itemOrders[m.id] = m.id === moduleId ? newIds : m.items.map((i) => i.id);
    }
    await reorderCurriculum(
      course.id,
      course.modules.map((m) => m.id),
      itemOrders,
    );
    router.refresh();
  }

  async function addModule() {
    await createModule(course.id, `Module ${course.modules.length + 1}`);
    router.refresh();
  }

  async function onPickItem(type: CourseItemType, track: CourseItemTrack) {
    if (!pickerModuleId) return;
    await createCourseItem(pickerModuleId, type, "", track);
    setPickerModuleId(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <div className="min-w-0 flex-1">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-medium text-storm-navy">Curriculum</h2>
          <button
            type="button"
            onClick={addModule}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-storm-pink px-4 py-2 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" /> Add module
          </button>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleModuleDragEnd}>
          <SortableContext
            items={course.modules.map((m) => m.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3">
              {course.modules.map((mod) => (
                <SortableModule
                  key={mod.id}
                  mod={mod}
                  expanded={expanded[mod.id] ?? true}
                  onToggle={() =>
                    setExpanded((e) => ({ ...e, [mod.id]: !e[mod.id] }))
                  }
                  onSelectModule={() => setSelection({ kind: "module", moduleId: mod.id })}
                  onSelectItem={(id) => setSelection({ kind: "item", itemId: id })}
                  onAddItem={() => setPickerModuleId(mod.id)}
                  onItemDragEnd={(e) => handleItemDragEnd(mod.id, e)}
                  onDuplicate={async (id) => {
                    await duplicateCourseItem(id);
                    router.refresh();
                  }}
                  onArchive={async (id) => {
                    await archiveCourseItem(id);
                    router.refresh();
                  }}
                  selectedId={
                    selection?.kind === "item"
                      ? selection.itemId
                      : selection?.kind === "module" && selection.moduleId === mod.id
                        ? mod.id
                        : undefined
                  }
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {course.modules.length === 0 && (
          <p className="text-sm text-storm-navy/60">Add a module to start building.</p>
        )}
      </div>

      <BuilderDrawer
        course={course}
        selection={selection}
        onClose={() => setSelection(null)}
      />

      <AddContentPicker
        open={!!pickerModuleId}
        onClose={() => setPickerModuleId(null)}
        onPick={onPickItem}
      />
    </div>
  );
}

function SortableModule({
  mod,
  expanded,
  onToggle,
  onSelectModule,
  onSelectItem,
  onAddItem,
  onItemDragEnd,
  onDuplicate,
  onArchive,
  selectedId,
}: {
  mod: CourseBuilderCourse["modules"][0];
  expanded: boolean;
  onToggle: () => void;
  onSelectModule: () => void;
  onSelectItem: (id: string) => void;
  onAddItem: () => void;
  onItemDragEnd: (e: DragEndEvent) => void;
  onDuplicate: (id: string) => void;
  onArchive: (id: string) => void;
  selectedId?: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: mod.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="rounded-xl border bg-white overflow-hidden">
      <div className="flex items-center gap-2 border-b border-storm-light-blue/40 px-3 py-2">
        <button type="button" className="cursor-grab p-1" {...attributes} {...listeners}>
          <GripVertical className="h-4 w-4 text-storm-navy/40" />
        </button>
        <button type="button" onClick={onToggle} className="p-1">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={onSelectModule}
          className="min-w-0 flex-1 text-left font-medium text-storm-navy hover:underline"
        >
          {mod.title}
        </button>
        <span className="text-xs text-storm-navy/50">{mod.status}</span>
      </div>
      {expanded && (
        <div className="p-2">
          <DndContext collisionDetection={closestCenter} onDragEnd={onItemDragEnd}>
            <SortableContext items={mod.items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              <ul className="space-y-1">
                {mod.items.map((item) => (
                  <SortableItemRow
                    key={item.id}
                    item={item}
                    selected={selectedId === item.id}
                    onSelect={() => onSelectItem(item.id)}
                    onDuplicate={() => onDuplicate(item.id)}
                    onArchive={() => onArchive(item.id)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
          <button
            type="button"
            onClick={onAddItem}
            className="mt-2 flex w-full min-h-10 items-center justify-center gap-2 rounded-lg border border-dashed border-storm-light-blue/60 text-sm text-storm-medium-blue"
          >
            <Plus className="h-4 w-4" /> Add item
          </button>
        </div>
      )}
    </div>
  );
}

function SortableItemRow({
  item,
  selected,
  onSelect,
  onDuplicate,
  onArchive,
}: {
  item: CourseBuilderItem;
  selected: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onArchive: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className={`flex items-center gap-2 rounded-lg px-2 py-2 text-sm ${
        selected ? "bg-storm-medium-blue/10 ring-1 ring-storm-medium-blue/30" : "hover:bg-storm-light-grey/50"
      }`}
    >
      <button type="button" className="cursor-grab p-1" {...attributes} {...listeners}>
        <GripVertical className="h-3 w-3 text-storm-navy/40" />
      </button>
      <ItemTypeIcon type={item.itemType} />
      <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-left">
        <span className="font-medium text-storm-navy">{item.title}</span>
        <span className="ml-2 text-xs text-storm-navy/50">
          {ITEM_TYPE_LABELS[item.itemType]}
          {item.estimatedMinutes ? ` · ${item.estimatedMinutes} min` : ""}
          {item.isRequired ? " · Required" : ""}
          · {TRACK_LABELS[item.track]}
        </span>
      </button>
      <span className="shrink-0 text-xs text-storm-navy/40">{item.status}</span>
      <button type="button" onClick={onDuplicate} className="text-xs text-storm-medium-blue">
        Dup
      </button>
      <button type="button" onClick={onArchive} className="text-xs text-red-600">
        Del
      </button>
    </li>
  );
}
