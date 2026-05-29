"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { LibraryTagListItem } from "@/lib/library/types";
import { LibraryTagChip } from "@/components/library/LibraryTagChip";
import { Check, ChevronDown, Search, X } from "lucide-react";

type BaseProps = {
  tags: LibraryTagListItem[];
  disabled?: boolean;
  showCounts?: boolean;
  placeholder?: string;
  className?: string;
  label?: string;
  placement?: "bottom" | "top";
};

type SingleProps = BaseProps & {
  mode: "single";
  value: string | null;
  onChange: (tagId: string | null) => void;
  allLabel?: string;
  includeUntagged?: boolean;
  untaggedCount?: number;
};

type MultipleProps = BaseProps & {
  mode: "multiple";
  value: string[];
  onChange: (tagIds: string[]) => void;
};

export const LIBRARY_UNTAGGED_NAV_ID = "__untagged__";

export function LibraryTagDropdown(props: SingleProps | MultipleProps) {
  const {
    tags,
    disabled,
    showCounts = true,
    placeholder = "Search tags…",
    className = "",
    label,
    placement = "bottom",
  } = props;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const filteredTags = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tags;
    return tags.filter((tag) => tag.name.toLowerCase().includes(q));
  }, [tags, query]);

  const selectedTag =
    props.mode === "single" && props.value
      ? tags.find((t) => t.id === props.value)
      : null;

  const selectedTags =
    props.mode === "multiple"
      ? tags.filter((t) => props.value.includes(t.id))
      : [];

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function toggleMultiple(tagId: string) {
    if (props.mode !== "multiple") return;
    const next = props.value.includes(tagId)
      ? props.value.filter((id) => id !== tagId)
      : [...props.value, tagId];
    props.onChange(next);
  }

  function selectSingle(tagId: string | null) {
    if (props.mode !== "single") return;
    props.onChange(tagId);
    setOpen(false);
    setQuery("");
  }

  const triggerLabel =
    props.mode === "single"
      ? props.value === LIBRARY_UNTAGGED_NAV_ID
        ? "Untagged"
        : selectedTag
          ? selectedTag.name
          : props.allLabel ?? "All tags"
      : selectedTags.length === 0
        ? "Select tags…"
        : `${selectedTags.length} tag${selectedTags.length === 1 ? "" : "s"} selected`;

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      {label && (
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-storm-navy/50">
          {label}
        </p>
      )}

      <button
        type="button"
        disabled={disabled || tags.length === 0}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-9 w-full items-center justify-between gap-2 rounded-lg border border-storm-light-blue/60 bg-white px-2.5 py-1.5 text-left text-sm text-storm-navy hover:border-storm-medium-blue/50 disabled:cursor-not-allowed disabled:opacity-50"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate">
          {props.mode === "single" && selectedTag ? (
            <LibraryTagChip tag={selectedTag} active />
          ) : props.mode === "multiple" && selectedTags.length > 0 ? (
            <span className="flex flex-wrap gap-1">
              {selectedTags.slice(0, 2).map((tag) => (
                <LibraryTagChip key={tag.id} tag={tag} active />
              ))}
              {selectedTags.length > 2 && (
                <span className="text-xs text-storm-navy/55">
                  +{selectedTags.length - 2}
                </span>
              )}
            </span>
          ) : (
            <span className="truncate text-storm-navy/70">{triggerLabel}</span>
          )}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-storm-navy/50 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {props.mode === "multiple" && selectedTags.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {selectedTags.map((tag) => (
            <LibraryTagChip
              key={tag.id}
              tag={tag}
              active
              onClick={() => !disabled && toggleMultiple(tag.id)}
            />
          ))}
        </div>
      )}

      {open && (
        <div
          className={`absolute left-0 right-0 z-20 overflow-hidden rounded-lg border border-storm-light-blue/60 bg-white shadow-lg ${
            placement === "top" ? "bottom-full mb-1" : "top-full mt-1"
          }`}
        >
          <div className="border-b border-storm-light-blue/40 p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-storm-navy/40" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={placeholder}
                autoFocus
                className="w-full rounded-md border border-storm-light-blue/50 py-1.5 pl-8 pr-8 text-sm outline-none focus:border-storm-medium-blue/60 focus:ring-1 focus:ring-storm-medium-blue/30"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-storm-navy/45 hover:text-storm-navy"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          <ul
            role="listbox"
            className="max-h-52 overflow-y-auto py-1"
            aria-label={label ?? "Tags"}
          >
            {props.mode === "single" && (
              <li>
                <button
                  type="button"
                  role="option"
                  aria-selected={props.value === null}
                  onClick={() => selectSingle(null)}
                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-storm-light-blue/15 ${
                    props.value === null ? "bg-storm-medium-blue/10 font-medium" : ""
                  }`}
                >
                  <span>{props.allLabel ?? "All tags"}</span>
                  {props.value === null && (
                    <Check className="h-4 w-4 text-storm-medium-blue" />
                  )}
                </button>
              </li>
            )}

            {props.mode === "single" && props.includeUntagged && (
              <li>
                <button
                  type="button"
                  role="option"
                  aria-selected={props.value === LIBRARY_UNTAGGED_NAV_ID}
                  onClick={() => selectSingle(LIBRARY_UNTAGGED_NAV_ID)}
                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-storm-light-blue/15 ${
                    props.value === LIBRARY_UNTAGGED_NAV_ID
                      ? "bg-storm-medium-blue/10 font-medium"
                      : ""
                  }`}
                >
                  <span>Untagged</span>
                  <span className="flex items-center gap-2">
                    {(props.untaggedCount ?? 0) > 0 && (
                      <span className="text-xs text-storm-navy/45">
                        {props.untaggedCount}
                      </span>
                    )}
                    {props.value === LIBRARY_UNTAGGED_NAV_ID && (
                      <Check className="h-4 w-4 text-storm-medium-blue" />
                    )}
                  </span>
                </button>
              </li>
            )}

            {filteredTags.length === 0 ? (
              <li className="px-3 py-4 text-center text-sm text-storm-navy/50">
                No tags match &ldquo;{query}&rdquo;
              </li>
            ) : (
              filteredTags.map((tag) => {
                const isSelected =
                  props.mode === "single"
                    ? props.value === tag.id
                    : props.value.includes(tag.id);

                return (
                  <li key={tag.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() =>
                        props.mode === "single"
                          ? selectSingle(tag.id)
                          : toggleMultiple(tag.id)
                      }
                      className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-storm-light-blue/15 ${
                        isSelected ? "bg-storm-medium-blue/10" : ""
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        {props.mode === "multiple" && (
                          <span
                            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                              isSelected
                                ? "border-storm-medium-blue bg-storm-medium-blue text-white"
                                : "border-storm-light-blue/70"
                            }`}
                          >
                            {isSelected && <Check className="h-3 w-3" />}
                          </span>
                        )}
                        <LibraryTagChip tag={tag} active={isSelected} />
                      </span>
                      {showCounts && (
                        <span className="shrink-0 text-xs text-storm-navy/45">
                          {tag.assetCount}
                        </span>
                      )}
                      {props.mode === "single" && isSelected && (
                        <Check className="h-4 w-4 shrink-0 text-storm-medium-blue" />
                      )}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
