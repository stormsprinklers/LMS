"use client";

import type { LibraryTagListItem } from "@/lib/library/types";

const DEFAULT_COLORS = [
  "#4C9BC8",
  "#2D6A4F",
  "#BC4749",
  "#6B705C",
  "#7B61FF",
  "#E09F3E",
];

export function tagChipStyle(color: string | null | undefined, active?: boolean) {
  const bg = color || DEFAULT_COLORS[0];
  return {
    backgroundColor: active ? bg : `${bg}22`,
    color: active ? "#fff" : bg,
    borderColor: `${bg}55`,
  } as const;
}

export function LibraryTagChip({
  tag,
  active,
  onClick,
  count,
}: {
  tag: Pick<LibraryTagListItem, "id" | "name" | "color">;
  active?: boolean;
  onClick?: () => void;
  count?: number;
}) {
  const style = tagChipStyle(tag.color, active);
  const TagEl = onClick ? "button" : "span";
  return (
    <TagEl
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${
        onClick ? "cursor-pointer hover:opacity-90" : ""
      }`}
      style={style}
    >
      {tag.name}
      {count != null && <span className="opacity-80">({count})</span>}
    </TagEl>
  );
}

export function LibraryTagList({
  tags,
  activeTagId,
  onTagClick,
  showCounts,
  tagCounts,
}: {
  tags: Pick<LibraryTagListItem, "id" | "name" | "color">[];
  activeTagId?: string | null;
  onTagClick?: (tagId: string) => void;
  showCounts?: boolean;
  tagCounts?: Record<string, number>;
}) {
  if (tags.length === 0) {
    return <p className="text-xs text-storm-navy/50">No tags yet.</p>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <LibraryTagChip
          key={tag.id}
          tag={tag}
          active={activeTagId === tag.id}
          onClick={onTagClick ? () => onTagClick(tag.id) : undefined}
          count={showCounts ? tagCounts?.[tag.id] : undefined}
        />
      ))}
    </div>
  );
}
