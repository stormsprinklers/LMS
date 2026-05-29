"use client";

import { useEffect, useState } from "react";
import type { LibraryAssetListItem } from "@/lib/actions/library";
import {
  archiveLibraryAsset,
  reprocessLibraryAsset,
} from "@/lib/actions/library";
import {
  LibraryAssetMedia,
  libraryAssetCanDownload,
  libraryAssetOpensExternally,
} from "@/components/library/LibraryAssetMedia";
import { assetDisplaySize } from "@/lib/library/folders";
import { fetchLibraryTags, saveLibraryAssetTags } from "@/lib/library/client";
import type { LibraryTagListItem } from "@/lib/library/types";
import { kindLabel } from "@/lib/media/asset-utils";
import { Badge } from "@/components/ui/Badge";
import { LibraryTagChip } from "@/components/library/LibraryTagChip";
import { formatDate } from "@/lib/utils";
import {
  Download,
  ExternalLink,
  Loader2,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";

export function LibraryAssetDetailModal({
  asset,
  busy,
  onClose,
  onRefresh,
  setBusy,
  setError,
}: {
  asset: LibraryAssetListItem;
  busy: boolean;
  onClose: () => void;
  onRefresh: () => void;
  setBusy: (v: boolean) => void;
  setError: (v: string) => void;
}) {
  const [allTags, setAllTags] = useState<LibraryTagListItem[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState(asset.tags.map((t) => t.id));
  const [tagsDirty, setTagsDirty] = useState(false);

  useEffect(() => {
    void fetchLibraryTags().then((r) => {
      if (r.tags) setAllTags(r.tags);
    });
  }, []);

  useEffect(() => {
    setSelectedTagIds(asset.tags.map((t) => t.id));
    setTagsDirty(false);
  }, [asset.id, asset.tags]);

  function toggleTag(tagId: string) {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
    );
    setTagsDirty(true);
  }

  async function saveTags() {
    setBusy(true);
    const result = await saveLibraryAssetTags(asset.id, selectedTagIds);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setTagsDirty(false);
    onRefresh();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={asset.title}
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b px-4 py-3 sm:px-6">
          <div className="min-w-0 pr-4">
            <h2 className="font-title text-lg font-semibold text-storm-navy">
              {asset.title}
            </h2>
            <p className="mt-1 text-xs text-storm-navy/50">
              {kindLabel(asset.kind)} · {assetDisplaySize(asset)} ·{" "}
              {formatDate(asset.createdAt)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-storm-navy/60 hover:bg-storm-light-grey/60"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-4 sm:p-6">
          <div className="flex flex-wrap gap-2">
            <Badge variant={asset.scope === "shared" ? "info" : "default"}>
              {asset.scope === "shared" ? "Shared" : "Personal"}
            </Badge>
            {asset.processingStatus === "ready" && (
              <Badge variant="success">Ready</Badge>
            )}
            {asset.processingStatus === "processing" && (
              <Badge variant="info">Processing</Badge>
            )}
            {asset.processingStatus === "failed" && (
              <Badge variant="warning">Failed</Badge>
            )}
          </div>

          <p className="text-sm text-storm-navy/80">{asset.description}</p>

          {allTags.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-storm-navy">Tags</p>
              <div className="flex flex-wrap gap-2">
                {allTags.map((tag) => (
                  <label
                    key={tag.id}
                    className="inline-flex cursor-pointer items-center gap-1.5"
                  >
                    <input
                      type="checkbox"
                      checked={selectedTagIds.includes(tag.id)}
                      onChange={() => toggleTag(tag.id)}
                      disabled={busy}
                    />
                    <LibraryTagChip tag={tag} active={selectedTagIds.includes(tag.id)} />
                  </label>
                ))}
              </div>
              {tagsDirty && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void saveTags()}
                  className="rounded-lg border px-3 py-1.5 text-sm font-medium"
                >
                  Save tags
                </button>
              )}
            </div>
          )}

          {asset.processingError && (
            <p className="text-sm text-red-700">{asset.processingError}</p>
          )}

          <LibraryAssetMedia asset={asset} />

          <div className="flex flex-wrap gap-2 border-t pt-4">
            {libraryAssetOpensExternally(asset) && asset.blobUrl && (
              <a
                href={asset.blobUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-semibold text-storm-medium-blue no-underline"
              >
                <ExternalLink className="h-4 w-4" />
                Open link
              </a>
            )}
            {libraryAssetCanDownload(asset) && (
              <a
                href={`/api/library/assets/${asset.id}/download`}
                className="inline-flex items-center gap-1 rounded-lg bg-storm-navy px-3 py-2 text-sm font-semibold text-white no-underline"
              >
                <Download className="h-4 w-4" />
                Download
              </a>
            )}
            {(asset.processingStatus === "failed" ||
              asset.processingStatus === "pending") && (
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  const result = await reprocessLibraryAsset(asset.id);
                  setBusy(false);
                  if (result.error) setError(result.error);
                  else onRefresh();
                }}
                className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm"
              >
                <RefreshCw className="h-4 w-4" />
                Retry processing
              </button>
            )}
            {asset.isOwner && (
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  if (!confirm("Remove this item from the library?")) return;
                  setBusy(true);
                  const result = await archiveLibraryAsset(asset.id);
                  setBusy(false);
                  if (result.error) setError(result.error);
                  else {
                    onClose();
                    onRefresh();
                  }
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-sm text-red-800"
              >
                <Trash2 className="h-4 w-4" />
                Remove
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function LibraryBusyOverlay({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 flex items-center gap-2 rounded-lg bg-storm-navy px-4 py-2 text-sm text-white shadow-lg">
      <Loader2 className="h-4 w-4 animate-spin" />
      Working…
    </div>
  );
}
