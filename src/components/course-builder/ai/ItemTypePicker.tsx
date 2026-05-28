"use client";

import {
  ALL_BLUEPRINT_ITEM_TYPES,
  ITEM_TYPE_DESCRIPTIONS,
  ITEM_TYPE_LABELS,
  type BlueprintItemType,
} from "@/lib/ai/allowed-item-types";

export function ItemTypePicker({
  value,
  onChange,
}: {
  value: BlueprintItemType[];
  onChange: (next: BlueprintItemType[]) => void;
}) {
  function toggle(type: BlueprintItemType) {
    if (value.includes(type)) {
      const next = value.filter((t) => t !== type);
      if (next.length > 0) onChange(next);
    } else {
      onChange([...value, type]);
    }
  }

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-storm-navy">
        Content types to include <span className="text-red-600">*</span>
      </legend>
      <p className="text-xs text-storm-navy/60">
        Select only the item types you want in this course. AI will not add types you
        leave unchecked.
      </p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {ALL_BLUEPRINT_ITEM_TYPES.map((type) => (
          <label
            key={type}
            className={`flex cursor-pointer gap-3 rounded-lg border p-3 text-sm transition-colors ${
              value.includes(type)
                ? "border-storm-medium-blue bg-storm-medium-blue/5"
                : "border-storm-light-blue/50 hover:bg-storm-light-grey/30"
            }`}
          >
            <input
              type="checkbox"
              className="mt-0.5"
              checked={value.includes(type)}
              onChange={() => toggle(type)}
            />
            <span>
              <span className="font-medium text-storm-navy">{ITEM_TYPE_LABELS[type]}</span>
              <span className="mt-0.5 block text-xs text-storm-navy/60">
                {ITEM_TYPE_DESCRIPTIONS[type]}
              </span>
            </span>
          </label>
        ))}
      </div>
      {value.length === 0 && (
        <p className="text-xs text-red-600">Select at least one content type.</p>
      )}
    </fieldset>
  );
}
