"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  archiveLibraryAsset,
  reprocessLibraryAsset,
  type LibraryAssetListItem,
} from "@/lib/actions/library";
import { fetchLibraryAssets } from "@/lib/library/client";
import type { LibraryTagListItem } from "@/lib/library/types";
import { LibraryTagChip } from "@/components/library/LibraryTagChip";
import {
  LIBRARY_FOLDERS,
  assetFolder,
  assetInFolder,
  folderUploadType,
  type LibraryFolderId,
  type LibraryUploadType,
} from "@/lib/library/folders";
import {
  LibraryAssetTile,
  LibraryFolderTile,
} from "@/components/library/LibraryAssetTile";
import { LibraryUploadModal } from "@/components/library/LibraryUploadModal";
import {
  LibraryAssetDetailModal,
  LibraryBusyOverlay,
} from "@/components/library/LibraryAssetDetailModal";
import {
  ChevronRight,
  FileText,
  Folder,
  Globe,
  Image as ImageIcon,
  Music,
  Plus,
  Video,
} from "lucide-react";

const FOLDER_ICONS: Record<LibraryFolderId, React.ReactNode> = {
  documents: <FileText className="h-8 w-8" />,
  images: <ImageIcon className="h-8 w-8" />,
  videos: <Video className="h-8 w-8" />,
  audio: <Music className="h-8 w-8" />,
  links: <Globe className="h-8 w-8" />,
};

type ScopeFilter = "all" | "shared" | "personal";

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
  const [tags] = useState(initialTags);
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("all");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [currentFolder, setCurrentFolder] = useState<LibraryFolderId | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<LibraryAssetListItem | null>(
    null,
  );
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadPreset, setUploadPreset] = useState<LibraryUploadType | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    const result = await fetchLibraryAssets();
    if (result.assets) setAssets(result.assets);
    if (result.error) setError(result.error);
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
        if (tagFilter && !a.tags.some((t) => t.id === tagFilter)) return false;
        return true;
      }),
    [assets, scopeFilter, tagFilter],
  );

  const folderCounts = useMemo(() => {
    const counts: Record<LibraryFolderId, number> = {
      documents: 0,
      images: 0,
      videos: 0,
      audio: 0,
      links: 0,
    };
    for (const a of scopedAssets) {
      counts[assetFolder(a)]++;
    }
    return counts;
  }, [scopedAssets]);

  const folderAssets = useMemo(() => {
    if (!currentFolder) return [];
    return scopedAssets.filter((a) => assetInFolder(a, currentFolder));
  }, [scopedAssets, currentFolder]);

  const taggedAssets = useMemo(() => {
    if (!tagFilter) return [];
    return scopedAssets;
  }, [scopedAssets, tagFilter]);

  const activeTag = tags.find((t) => t.id === tagFilter);

  function openUpload() {
    setUploadPreset(currentFolder ? folderUploadType(currentFolder) : null);
    setUploadOpen(true);
  }

  const currentFolderLabel =
    LIBRARY_FOLDERS.find((f) => f.id === currentFolder)?.label ?? "Library";

  return (
    <div className="overflow-hidden rounded-xl border border-storm-light-blue/40 bg-white">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 border-b border-storm-light-blue/40 bg-storm-light-grey/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <nav className="flex min-w-0 flex-wrap items-center gap-1 text-sm text-storm-navy/70">
          <button
            type="button"
            onClick={() => {
              setCurrentFolder(null);
              setSelectedAsset(null);
            }}
            className="inline-flex items-center gap-1 font-medium text-storm-navy hover:text-storm-medium-blue"
          >
            <Folder className="h-4 w-4" />
            Library
          </button>
          {currentFolder && (
            <>
              <ChevronRight className="h-4 w-4 shrink-0" />
              <span className="truncate font-medium text-storm-navy">
                {currentFolderLabel}
              </span>
            </>
          )}
        </nav>

        <div className="flex flex-wrap items-center gap-2">
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
            onClick={openUpload}
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
        {/* Sidebar — folder tree */}
        <aside className="hidden w-44 shrink-0 border-r border-storm-light-blue/40 bg-storm-light-grey/20 p-2 sm:block md:w-52">
          <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-storm-navy/50">
            Folders
          </p>
          <ul className="space-y-0.5">
            {LIBRARY_FOLDERS.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => {
                    setCurrentFolder(f.id);
                    setSelectedAsset(null);
                  }}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm ${
                    currentFolder === f.id
                      ? "bg-storm-medium-blue/15 font-medium text-storm-navy"
                      : "text-storm-navy/80 hover:bg-storm-light-blue/20"
                  }`}
                >
                  <span className="shrink-0 scale-75 text-storm-medium-blue">
                    {FOLDER_ICONS[f.id]}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{f.label}</span>
                  <span className="text-xs text-storm-navy/45">{folderCounts[f.id]}</span>
                </button>
              </li>
            ))}
          </ul>
          {tags.length > 0 && (
            <>
              <p className="mt-4 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-storm-navy/50">
                Tags
              </p>
              <div className="space-y-1 px-1">
                <button
                  type="button"
                  onClick={() => setTagFilter(null)}
                  className={`w-full rounded-md px-2 py-1.5 text-left text-sm ${
                    tagFilter === null
                      ? "bg-storm-medium-blue/15 font-medium text-storm-navy"
                      : "text-storm-navy/80 hover:bg-storm-light-blue/20"
                  }`}
                >
                  All tags
                </button>
                {tags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => {
                      setTagFilter(tag.id);
                      setCurrentFolder(null);
                    }}
                    className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm ${
                      tagFilter === tag.id
                        ? "bg-storm-medium-blue/15 font-medium text-storm-navy"
                        : "text-storm-navy/80 hover:bg-storm-light-blue/20"
                    }`}
                  >
                    <LibraryTagChip tag={tag} />
                    <span className="ml-2 text-xs text-storm-navy/45">{tag.assetCount}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </aside>

        {/* Main pane */}
        <div className="min-w-0 flex-1 p-4 sm:p-6">
          {!currentFolder ? (
            tagFilter ? (
              <>
                <p className="mb-4 text-sm text-storm-navy/60">
                  {taggedAssets.length} item{taggedAssets.length === 1 ? "" : "s"} tagged{" "}
                  {activeTag ? (
                    <LibraryTagChip tag={activeTag} active />
                  ) : (
                    "with this tag"
                  )}
                  . Open a folder to narrow by type.
                </p>
                {taggedAssets.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <Folder className="h-12 w-12 text-storm-light-blue" />
                    <p className="mt-3 text-sm text-storm-navy/60">
                      No items with this tag yet.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    {taggedAssets.map((asset) => (
                      <LibraryAssetTile
                        key={asset.id}
                        asset={asset}
                        onClick={() => setSelectedAsset(asset)}
                      />
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <p className="mb-4 text-sm text-storm-navy/60">
                  Choose a folder to browse files, or upload new materials.
                </p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  {LIBRARY_FOLDERS.map((f) => (
                    <LibraryFolderTile
                      key={f.id}
                      label={f.label}
                      count={folderCounts[f.id]}
                      icon={FOLDER_ICONS[f.id]}
                      onClick={() => setCurrentFolder(f.id)}
                    />
                  ))}
                </div>
              </>
            )
          ) : folderAssets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Folder className="h-12 w-12 text-storm-light-blue" />
              <p className="mt-3 text-sm text-storm-navy/60">
                {tagFilter
                  ? "No items with this tag in this folder."
                  : `No items in ${currentFolderLabel.toLowerCase()} yet.`}
              </p>
              <button
                type="button"
                onClick={openUpload}
                className="mt-4 text-sm font-medium text-storm-medium-blue hover:underline"
              >
                + Upload
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {folderAssets.map((asset) => (
                <LibraryAssetTile
                  key={asset.id}
                  asset={asset}
                  onClick={() => setSelectedAsset(asset)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <LibraryUploadModal
        open={uploadOpen}
        onClose={() => {
          setUploadOpen(false);
          setUploadPreset(null);
        }}
        initialUploadType={uploadPreset}
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
