"use client";

import { useEffect, useState } from "react";
import { fetchLibraryAssets } from "@/lib/library/client";
import type { LibraryAssetListItem } from "@/lib/library/types";
import { kindLabel } from "@/lib/media/asset-utils";
import { Badge } from "@/components/ui/Badge";

export function LibraryPicker({
  selectedIds,
  onChange,
  disabled,
}: {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const [assets, setAssets] = useState<LibraryAssetListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const result = await fetchLibraryAssets();
      if (cancelled) return;
      if (result.error) setError(result.error);
      else setAssets(result.assets ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const ready = assets.filter((a) => a.processingStatus === "ready");

  function toggle(id: string) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  }

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
              <span className="line-clamp-2 text-xs text-storm-navy/60">
                {asset.description}
              </span>
            </span>
          </label>
        </li>
      ))}
    </ul>
  );
}
