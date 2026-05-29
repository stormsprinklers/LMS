"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { LibraryAssetListItem } from "@/lib/actions/library";
import { fetchLibraryAssets, fetchLibraryTags } from "@/lib/library/client";
import type { LibraryTagListItem } from "@/lib/library/types";
import { LibraryTagChip } from "@/components/library/LibraryTagChip";
import {
  LIBRARY_UNTAGGED_NAV_ID,
  LibraryTagDropdown,
} from "@/components/library/LibraryTagDropdown";
import { LibraryAssetTile, LibraryTagTile } from "@/components/library/LibraryAssetTile";
import { LibraryUploadModal } from "@/components/library/LibraryUploadModal";
import {
  LibraryAssetDetailModal,
  LibraryBusyOverlay,
} from "@/components/library/LibraryAssetDetailModal";
import {
  ChevronRight,
  LayoutGrid,
  Plus,
  Search,
  Tag,
  X,
} from "lucide-react";

type ScopeFilter = "all" | "shared" | "personal";
type TagNavId = string | null;

export function LibraryExplorer({
  canPublishShared,
  initialAssets,
  initialTags = [],
}: {
  canPublishShared: boolean;
  initialAssets: LibraryAssetListItem[];
  initialTags?: LibraryTagListItem[];
}) {
  const [assets, setAssets] = useState(initialAssets);
  const [tags, setTags] = useState(initialTags);
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("all");
  const [tagNav, setTagNav] = useState<TagNavId>(null);
  const [tagSearch, setTagSearch] = useState("");
  const [selectedAsset, setSelectedAsset] = useState<LibraryAssetListItem | null>(
    null,
  );
  const [uploadOpen, setUploadOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    const [assetResult, tagResult] = await Promise.all([
      fetchLibraryAssets(),
      fetchLibraryTags(),
    ]);
    if (assetResult.assets) setAssets(assetResult.assets);
    if (tagResult.tags) setTags(tagResult.tags);
    if (assetResult.error) setError(assetResult.error);
  }, []);

  useEffect(() => {
    const pending = assets.some(
      (a) => a.processingStatus === "pending" || a.processingStatus === "processing",
    );
    if (!pending) return;
    const t = setInterval(() => void refresh(), 4000);
    return () => clearInterval(t);
  }, [assets, refresh]);

  const scopedAssets = useMemo(
    () =>
      assets.filter((a) => {
        if (scopeFilter === "shared") return a.scope === "shared";
        if (scopeFilter === "personal") return a.scope === "personal";
        return true;
      }),
    [assets, scopeFilter],
  );

  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const tag of tags) counts.set(tag.id, 0);
    let untagged = 0;
    for (const asset of scopedAssets) {
      if (asset.tags.length === 0) untagged++;
      for (const tag of asset.tags) {
        counts.set(tag.id, (counts.get(tag.id) ?? 0) + 1);
      }
    }
    return { byTag: counts, untagged, all: scopedAssets.length };
  }, [scopedAssets, tags]);

  const visibleAssets = useMemo(() => {
    if (tagNav === null) return [];
    if (tagNav === LIBRARY_UNTAGGED_NAV_ID) {
      return scopedAssets.filter((a) => a.tags.length === 0);
    }
    return scopedAssets.filter((a) => a.tags.some((t) => t.id === tagNav));
  }, [scopedAssets, tagNav]);

  const filteredSidebarTags = useMemo(() => {
    const q = tagSearch.trim().toLowerCase();
    if (!q) return tags;
    return tags.filter((tag) => tag.name.toLowerCase().includes(q));
  }, [tags, tagSearch]);

  const activeTag =
    tagNav && tagNav !== LIBRARY_UNTAGGED_NAV_ID
      ? tags.find((t) => t.id === tagNav)
      : null;

  const navLabel =
    tagNav === null
      ? "Browse by tag"
      : tagNav === LIBRARY_UNTAGGED_NAV_ID
        ? "Untagged"
        : activeTag?.name ?? "Tag";

  function selectTagNav(next: TagNavId) {
    setTagNav(next);
    setSelectedAsset(null);
  }

  function goHome() {
    selectTagNav(null);
  }

  return (
    <div className="overflow-hidden rounded-xl border border-storm-light-blue/40 bg-white">
      <div className="flex flex-col gap-3 border-b border-storm-light-blue/40 bg-storm-light-grey/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <nav className="flex min-w-0 flex-wrap items-center gap-1 text-sm text-storm-navy/70">
          <button
            type="button"
            onClick={goHome}
            className="inline-flex items-center gap-1 font-medium text-storm-navy hover:text-storm-medium-blue"
          >
            <Tag className="h-4 w-4" />
            Library
          </button>
          {tagNav !== null && (
            <>
              <ChevronRight className="h-4 w-4 shrink-0" />
              {tagNav === LIBRARY_UNTAGGED_NAV_ID ? (
                <span className="truncate font-medium text-storm-navy">Untagged</span>
              ) : activeTag ? (
                <LibraryTagChip tag={activeTag} active />
              ) : (
                <span className="truncate font-medium text-storm-navy">{navLabel}</span>
              )}
            </>
          )}
        </nav>

        <div className="flex flex-wrap items-center gap-2">
          <div className="w-full min-w-[10rem] sm:hidden">
            <LibraryTagDropdown
              mode="single"
              tags={tags}
              value={tagNav}
              onChange={selectTagNav}
              allLabel="Browse tags"
              includeUntagged={tagCounts.untagged > 0}
              untaggedCount={tagCounts.untagged}
            />
          </div>
          {(["all", "shared", "personal"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setScopeFilter(f)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                scopeFilter === f
                  ? "bg-storm-medium-blue text-white"
                  : "bg-white text-storm-navy/70 ring-1 ring-storm-light-blue/50"
              }`}
            >
              {f === "all" ? "All" : f === "shared" ? "Shared" : "My items"}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-storm-medium-blue px-4 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" />
            Upload
          </button>
        </div>
      </div>

      {error && (
        <div className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}
      {message && (
        <div className="border-b border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
          {message}
        </div>
      )}

      <div className="flex min-h-[420px]">
        <aside className="hidden w-44 shrink-0 border-r border-storm-light-blue/40 bg-storm-light-grey/20 p-2 sm:block md:w-52">
          <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-storm-navy/50">
            Tags
          </p>
          <div className="relative mb-2 px-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-storm-navy/40" />
            <input
              type="search"
              value={tagSearch}
              onChange={(e) => setTagSearch(e.target.value)}
              placeholder="Search tags…"
              className="w-full rounded-md border border-storm-light-blue/50 py-1.5 pl-8 pr-7 text-sm outline-none focus:border-storm-medium-blue/60"
            />
            {tagSearch && (
              <button
                type="button"
                onClick={() => setTagSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-storm-navy/45 hover:text-storm-navy"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <ul className="max-h-[min(24rem,calc(100vh-16rem))] space-y-0.5 overflow-y-auto">
            <li>
              <button
                type="button"
                onClick={goHome}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm ${
                  tagNav === null
                    ? "bg-storm-medium-blue/15 font-medium text-storm-navy"
                    : "text-storm-navy/80 hover:bg-storm-light-blue/20"
                }`}
              >
                <LayoutGrid className="h-4 w-4 shrink-0 text-storm-medium-blue" />
                <span className="min-w-0 flex-1 truncate">Browse tags</span>
              </button>
            </li>
            {tagCounts.untagged > 0 && (
              <li>
                <button
                  type="button"
                  onClick={() => selectTagNav(LIBRARY_UNTAGGED_NAV_ID)}
                  className={`flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm ${
                    tagNav === LIBRARY_UNTAGGED_NAV_ID
                      ? "bg-storm-medium-blue/15 font-medium text-storm-navy"
                      : "text-storm-navy/80 hover:bg-storm-light-blue/20"
                  }`}
                >
                  <span>Untagged</span>
                  <span className="text-xs text-storm-navy/45">{tagCounts.untagged}</span>
                </button>
              </li>
            )}
            {filteredSidebarTags.length === 0 ? (
              <li className="px-2 py-3 text-xs text-storm-navy/50">
                {tagSearch ? "No tags match your search." : "No tags yet."}
              </li>
            ) : (
              filteredSidebarTags.map((tag) => (
                <li key={tag.id}>
                  <button
                    type="button"
                    onClick={() => selectTagNav(tag.id)}
                    className={`flex w-full items-center justify-between gap-1 rounded-md px-2 py-2 text-left text-sm ${
                      tagNav === tag.id
                        ? "bg-storm-medium-blue/15 font-medium text-storm-navy"
                        : "text-storm-navy/80 hover:bg-storm-light-blue/20"
                    }`}
                  >
                    <LibraryTagChip tag={tag} active={tagNav === tag.id} />
                    <span className="shrink-0 text-xs text-storm-navy/45">
                      {tagCounts.byTag.get(tag.id) ?? 0}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </aside>

        <div className="min-w-0 flex-1 p-4 sm:p-6">
          {tagNav === null ? (
            <>
              <p className="mb-4 text-sm text-storm-navy/60">
                Choose a tag to browse materials. Items can appear under multiple tags.
              </p>
              {tags.length === 0 && tagCounts.untagged === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Tag className="h-12 w-12 text-storm-light-blue" />
                  <p className="mt-3 text-sm text-storm-navy/60">
                    No tags yet. Admins can create tags above, then assign them when uploading
                    or editing items.
                  </p>
                  <button
                    type="button"
                    onClick={() => setUploadOpen(true)}
                    className="mt-4 text-sm font-medium text-storm-medium-blue hover:underline"
                  >
                    + Upload
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {tagCounts.untagged > 0 && (
                    <button
                      type="button"
                      onClick={() => selectTagNav(LIBRARY_UNTAGGED_NAV_ID)}
                      className="flex flex-col items-center rounded-lg border border-storm-light-blue/50 bg-white p-4 text-center transition-colors hover:border-storm-medium-blue/60 hover:bg-storm-light-blue/10"
                    >
                      <div className="flex h-10 items-center justify-center rounded-full border border-dashed border-storm-light-blue px-3 text-xs font-medium text-storm-navy/70">
                        Untagged
                      </div>
                      <p className="mt-3 text-sm font-semibold text-storm-navy">Untagged</p>
                      <p className="mt-0.5 text-xs text-storm-navy/50">
                        {tagCounts.untagged} item{tagCounts.untagged === 1 ? "" : "s"}
                      </p>
                    </button>
                  )}
                  {tags.map((tag) => {
                    const count = tagCounts.byTag.get(tag.id) ?? 0;
                    if (count === 0) return null;
                    return (
                      <LibraryTagTile
                        key={tag.id}
                        tag={tag}
                        count={count}
                        onClick={() => selectTagNav(tag.id)}
                      />
                    );
                  })}
                </div>
              )}
            </>
          ) : visibleAssets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Tag className="h-12 w-12 text-storm-light-blue" />
              <p className="mt-3 text-sm text-storm-navy/60">
                {tagNav === LIBRARY_UNTAGGED_NAV_ID
                  ? "All items are tagged."
                  : `No items with this tag${scopeFilter !== "all" ? " in this view" : ""} yet.`}
              </p>
              <button
                type="button"
                onClick={() => setUploadOpen(true)}
                className="mt-4 text-sm font-medium text-storm-medium-blue hover:underline"
              >
                + Upload
              </button>
            </div>
          ) : (
            <>
              <p className="mb-4 text-sm text-storm-navy/60">
                {visibleAssets.length} item{visibleAssets.length === 1 ? "" : "s"}
                {tagNav === LIBRARY_UNTAGGED_NAV_ID ? (
                  <> without tags</>
                ) : activeTag ? (
                  <>
                    {" "}
                    tagged <LibraryTagChip tag={activeTag} active />
                  </>
                ) : null}
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {visibleAssets.map((asset) => (
                  <LibraryAssetTile
                    key={asset.id}
                    asset={asset}
                    onClick={() => setSelectedAsset(asset)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <LibraryUploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        initialUploadType={null}
        canPublishShared={canPublishShared}
        onComplete={async () => {
          setMessage("Upload complete. Processing may take a minute for PDFs and videos.");
          await refresh();
        }}
      />

      {selectedAsset && (
        <LibraryAssetDetailModal
          asset={selectedAsset}
          busy={busy}
          onClose={() => setSelectedAsset(null)}
          onRefresh={refresh}
          setBusy={setBusy}
          setError={setError}
        />
      )}

      <LibraryBusyOverlay show={busy} />
    </div>
  );
}
