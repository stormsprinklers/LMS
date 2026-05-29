"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchLibraryAssets, fetchLibraryTags } from "@/lib/library/client";
import type { LibraryAssetListItem, LibraryTagListItem } from "@/lib/library/types";
import { kindLabel } from "@/lib/media/asset-utils";
import { Badge } from "@/components/ui/Badge";
import { LibraryTagChip, LibraryTagList } from "@/components/library/LibraryTagChip";

export function LibraryPicker({
  selectedIds,
  selectedTagIds,
  onChange,
  onTagSelectionChange,
  disabled,
}: {
  selectedIds: string[];
  selectedTagIds?: string[];
  onChange: (ids: string[]) => void;
  onTagSelectionChange?: (tagIds: string[]) => void;
  disabled?: boolean;
}) {
  const [assets, setAssets] = useState<LibraryAssetListItem[]>([]);
  const [tags, setTags] = useState<LibraryTagListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [assetResult, tagResult] = await Promise.all([
        fetchLibraryAssets(),
        fetchLibraryTags(),
      ]);
      if (cancelled) return;
      if (assetResult.error) setError(assetResult.error);
      else setAssets(assetResult.assets ?? []);
      if (!tagResult.error) setTags(tagResult.tags ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const ready = assets.filter((a) => a.processingStatus === "ready");

  const assetsByTag = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const tag of tags) {
      map.set(
        tag.id,
        ready.filter((a) => a.tags.some((t) => t.id === tag.id)).map((a) => a.id),
      );
    }
    return map;
  }, [ready, tags]);

  const tagSelection = selectedTagIds ?? [];

  function toggle(id: string) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  }

  function toggleTag(tagId: string) {
    if (!onTagSelectionChange) return;
    const next = tagSelection.includes(tagId)
      ? tagSelection.filter((id) => id !== tagId)
      : [...tagSelection, tagId];
    onTagSelectionChange(next);

    const tagAssetIds = assetsByTag.get(tagId) ?? [];
    if (tagSelection.includes(tagId)) {
      onChange(selectedIds.filter((id) => !tagAssetIds.includes(id)));
    } else {
      onChange([...new Set([...selectedIds, ...tagAssetIds])]);
    }
  }

  const selectedViaTagsCount = tagSelection.reduce(
    (n, tagId) => n + (assetsByTag.get(tagId)?.length ?? 0),
    0,
  );

  if (loading) {
    return <p className="text-sm text-storm-navy/60">Loading library…</p>;
  }
  if (error) {
    return <p className="text-sm text-red-700">{error}</p>;
  }
  if (ready.length === 0) {
    return (
      <p className="text-sm text-storm-navy/60">
        No ready library items.{" "}
        <a href="/library" className="text-storm-medium-blue underline">
          Upload in Library
        </a>{" "}
        first.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {tags.length > 0 && onTagSelectionChange && (
        <div className="rounded-lg border border-storm-light-blue/40 bg-storm-light-grey/20 p-3">
          <p className="text-xs font-medium text-storm-navy">Add by tag</p>
          <p className="mt-0.5 text-xs text-storm-navy/55">
            Select a tag to include all ready items with that tag.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {tags.map((tag) => {
              const count = assetsByTag.get(tag.id)?.length ?? 0;
              if (count === 0) return null;
              return (
                <LibraryTagChip
                  key={tag.id}
                  tag={tag}
                  active={tagSelection.includes(tag.id)}
                  count={count}
                  onClick={() => toggleTag(tag.id)}
                />
              );
            })}
          </div>
          {tagSelection.length > 0 && (
            <p className="mt-2 text-xs text-storm-navy/60">
              {tagSelection.length} tag(s) selected · up to {selectedViaTagsCount} items via
              tags (duplicates merge when added)
            </p>
          )}
        </div>
      )}

      <ul className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-storm-light-blue/40 p-2">
        {ready.map((asset) => (
          <li key={asset.id}>
            <label
              className={`flex cursor-pointer gap-3 rounded-lg p-2 hover:bg-storm-light-blue/20 ${
                disabled ? "pointer-events-none opacity-50" : ""
              }`}
            >
              <input
                type="checkbox"
                checked={selectedIds.includes(asset.id)}
                onChange={() => toggle(asset.id)}
                disabled={disabled}
                className="mt-1"
              />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-storm-navy">{asset.title}</span>
                  <Badge variant="default">{kindLabel(asset.kind)}</Badge>
                  {asset.scope === "shared" && (
                    <Badge variant="info">Shared</Badge>
                  )}
                </span>
                {asset.tags.length > 0 && (
                  <span className="mt-1 flex flex-wrap gap-1">
                    {asset.tags.map((tag) => (
                      <LibraryTagChip key={tag.id} tag={tag} />
                    ))}
                  </span>
                )}
                <span className="line-clamp-2 text-xs text-storm-navy/60">
                  {asset.description}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
