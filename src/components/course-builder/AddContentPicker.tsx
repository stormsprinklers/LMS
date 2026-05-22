"use client";

import type { CourseItemTrack, CourseItemType } from "@prisma/client";
import { ItemTypeIcon } from "./ItemTypeIcon";

const OPTIONS: { type: CourseItemType; label: string; track: CourseItemTrack }[] = [
  { type: "LESSON", label: "Lesson", track: "LEARN" },
  { type: "VIDEO", label: "Video", track: "LEARN" },
  { type: "QUIZ", label: "Quiz", track: "PROVE" },
  { type: "EXAM", label: "Exam", track: "PROVE" },
  { type: "SKILL_CHECK", label: "Skill Check", track: "PROVE" },
  { type: "SCENARIO", label: "Scenario", track: "PRACTICE" },
];

export function AddContentPicker({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (type: CourseItemType, track: CourseItemTrack) => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
        <h3 className="font-title text-lg font-bold text-storm-navy">What do you want to add?</h3>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {OPTIONS.map((o) => (
            <button
              key={o.type}
              type="button"
              onClick={() => {
                onPick(o.type, o.track);
                onClose();
              }}
              className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-lg border border-storm-light-blue/60 p-3 text-sm font-medium text-storm-navy hover:bg-storm-light-grey/50"
            >
              <ItemTypeIcon type={o.type} className="h-6 w-6" />
              {o.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full min-h-10 rounded-lg border text-sm text-storm-navy/70"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
