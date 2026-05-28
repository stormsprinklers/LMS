"use client";

import { useCallback, useEffect, useState } from "react";
import { upload } from "@vercel/blob/client";
import {
  archiveLibraryAsset,
  listLibraryAssets,
  reprocessLibraryAsset,
  uploadLibraryAsset,
  type LibraryAssetListItem,
} from "@/lib/actions/library";
import { LIBRARY_FILE_ACCEPT, MAX_MEDIA_FILE_BYTES, kindLabel } from "@/lib/media/asset-utils";
import { FileInput } from "@/components/ui/FileInput";
import {
  LibraryAssetMedia,
  libraryAssetCanDownload,
  libraryAssetHasInAppPreview,
  libraryAssetOpensExternally,
} from "@/components/library/LibraryAssetMedia";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";
import {
  Download,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Loader2,
  Music,
  RefreshCw,
  Trash2,
  Video,
} from "lucide-react";

function KindIcon({ kind }: { kind: string }) {
  if (kind === "image") return <ImageIcon className="h-5 w-5" />;
  if (kind === "video") return <Video className="h-5 w-5" />;
  if (kind === "audio") return <Music className="h-5 w-5" />;
  return <FileText className="h-5 w-5" />;
}

function statusBadge(status: string) {
  if (status === "ready") return <Badge variant="success">Ready</Badge>;
  if (status === "processing") return <Badge variant="info">Processing</Badge>;
  if (status === "failed") return <Badge variant="warning">Failed</Badge>;
  return <Badge variant="default">Pending</Badge>;
}

export function LibraryBrowser({
  canPublishShared,
  initialAssets,
}: {
  canPublishShared: boolean;
  initialAssets: LibraryAssetListItem[];
}) {
  const [assets, setAssets] = useState(initialAssets);
  const [filter, setFilter] = useState<"all" | "shared" | "personal">("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scope, setScope] = useState<"personal" | "shared">("personal");
  const [includeRecording, setIncludeRecording] = useState(true);
  const [sourceUrl, setSourceUrl] = useState("");
  const [urlKind, setUrlKind] = useState<"webpage" | "video">("webpage");
  const [pasteText, setPasteText] = useState("");

  const refresh = useCallback(async () => {
    const result = await listLibraryAssets();
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

  const filtered = assets.filter((a) => {
    if (filter === "shared") return a.scope === "shared";
    if (filter === "personal") return a.scope === "personal";
    return true;
  });

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const fd = new FormData(e.currentTarget);
      fd.set("title", title);
      fd.set("description", description);
      fd.set("scope", scope);
      fd.set("includeRecording", includeRecording ? "true" : "false");
      if (pasteText.trim()) {
        fd.set("pastedText", pasteText.trim());
      } else if (sourceUrl.trim()) {
        fd.set("sourceUrl", sourceUrl.trim());
        fd.set("urlKind", urlKind);
      } else {
        const file = fd.get("file");
        if (file instanceof File && file.size > 0) {
          if (file.size > MAX_MEDIA_FILE_BYTES) {
            setError("File exceeds 80MB limit.");
            return;
          }
          const blob = await upload(`library/${file.name}`, file, {
            access: "public",
            handleUploadUrl: "/api/library/upload",
          });
          fd.delete("file");
          fd.set("blobUrl", blob.url);
          fd.set("uploadedFilename", file.name);
          fd.set("uploadedMimeType", file.type || "");
        }
      }
      const result = await uploadLibraryAsset(fd);
      if (result.error) {
        setError(result.error);
        return;
      }
      setTitle("");
      setDescription("");
      setSourceUrl("");
      setPasteText("");
      (e.target as HTMLFormElement).reset();
      setMessage("Uploaded. Processing may take a minute for PDFs and videos.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleArchive(id: string) {
    if (!confirm("Remove this item from the library?")) return;
    setBusy(true);
    const result = await archiveLibraryAsset(id);
    setBusy(false);
    if (result.error) setError(result.error);
    else await refresh();
  }

  async function handleReprocess(id: string) {
    setBusy(true);
    const result = await reprocessLibraryAsset(id);
    setBusy(false);
    if (result.error) setError(result.error);
    else await refresh();
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
          {message}
        </div>
      )}

      <section className="rounded-xl border bg-white p-4 sm:p-6">
        <h2 className="font-title text-lg font-semibold text-storm-navy">Upload</h2>
        <p className="mt-1 text-sm text-storm-navy/70">
          Add files, links, or pasted text with a title and description. Shared items
          are visible to everyone; personal items are only visible to you (and AI when
          you attach them).
        </p>
        <form onSubmit={handleUpload} className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium text-storm-navy">Title</span>
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-full rounded-lg border border-storm-light-blue/60 px-3 py-2"
                placeholder="e.g. Fall protection checklist"
              />
            </label>
            {canPublishShared && (
              <label className="block text-sm">
                <span className="font-medium text-storm-navy">Visibility</span>
                <select
                  value={scope}
                  onChange={(e) =>
                    setScope(e.target.value as "personal" | "shared")
                  }
                  className="mt-1 w-full rounded-lg border border-storm-light-blue/60 px-3 py-2"
                >
                  <option value="personal">Personal (only me)</option>
                  <option value="shared">Shared (whole team)</option>
                </select>
              </label>
            )}
          </div>
          <label className="block text-sm">
            <span className="font-medium text-storm-navy">Description</span>
            <textarea
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-storm-light-blue/60 px-3 py-2"
              placeholder="What this is, when to use it, key topics for AI or learners…"
            />
          </label>

          <div className="space-y-3 rounded-lg border border-storm-light-blue/40 p-4">
            <p className="text-sm font-medium text-storm-navy">File</p>
            <FileInput name="file" accept={LIBRARY_FILE_ACCEPT} />
            <label className="flex items-center gap-2 text-sm text-storm-navy/80">
              <input
                type="checkbox"
                checked={includeRecording}
                onChange={(e) => setIncludeRecording(e.target.checked)}
              />
              For video files, keep recording for course playback (Mux)
            </label>
          </div>

          <details className="rounded-lg border border-storm-light-blue/40 p-4">
            <summary className="cursor-pointer text-sm font-medium text-storm-navy">
              Or add a link / pasted text
            </summary>
            <div className="mt-3 space-y-3">
              <label className="block text-sm">
                <span className="text-storm-navy/80">URL</span>
                <input
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  placeholder="https://…"
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={urlKind === "webpage"}
                  onChange={() => setUrlKind("webpage")}
                />
                Web page
                <input
                  type="radio"
                  checked={urlKind === "video"}
                  onChange={() => setUrlKind("video")}
                />
                Video (YouTube or file URL)
              </label>
              <label className="block text-sm">
                <span className="text-storm-navy/80">Pasted text</span>
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  rows={4}
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                />
              </label>
            </div>
          </details>

          <button
            type="submit"
            disabled={busy}
            className="min-h-11 rounded-lg bg-storm-medium-blue px-6 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? "Uploading…" : "Add to library"}
          </button>
        </form>
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h2 className="font-title text-lg font-semibold text-storm-navy">Browse</h2>
          {(["all", "shared", "personal"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                filter === f
                  ? "bg-storm-medium-blue text-white"
                  : "bg-storm-light-grey/60 text-storm-navy/70"
              }`}
            >
              {f === "all" ? "All" : f === "shared" ? "Shared" : "My items"}
            </button>
          ))}
        </div>

        <ul className="space-y-3">
          {filtered.map((asset) => (
            <li
              key={asset.id}
              className="rounded-xl border bg-white p-4"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-storm-light-blue text-storm-navy">
                  <KindIcon kind={asset.kind} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-title font-bold text-storm-navy">{asset.title}</h3>
                    {statusBadge(asset.processingStatus)}
                    <Badge variant={asset.scope === "shared" ? "info" : "default"}>
                      {asset.scope === "shared" ? "Shared" : "Personal"}
                    </Badge>
                    <Badge variant="default">{kindLabel(asset.kind)}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-storm-navy/70">{asset.description}</p>
                  <p className="mt-1 text-xs text-storm-navy/50">
                    {asset.filename ?? "—"} ·{" "}
                    {asset.createdBy.name ?? asset.createdBy.email} ·{" "}
                    {formatDate(asset.createdAt)}
                  </p>
                  {asset.processingError && (
                    <p className="mt-2 text-xs text-red-700">{asset.processingError}</p>
                  )}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col sm:items-end">
                  {libraryAssetOpensExternally(asset) && (
                    <a
                      href={asset.blobUrl!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg border border-storm-medium-blue px-3 py-2 text-sm font-semibold text-storm-medium-blue no-underline"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Open link
                    </a>
                  )}
                  {libraryAssetCanDownload(asset) && (
                    <a
                      href={asset.blobUrl!}
                      download
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
                      onClick={() => handleReprocess(asset.id)}
                      className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Retry
                    </button>
                  )}
                  {asset.isOwner && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleArchive(asset.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-sm text-red-800"
                    >
                      <Trash2 className="h-4 w-4" />
                      Remove
                    </button>
                  )}
                </div>
              </div>
              {(libraryAssetHasInAppPreview(asset) ||
                asset.processingStatus === "ready") && (
                <LibraryAssetMedia asset={asset} />
              )}
            </li>
          ))}
          {filtered.length === 0 && (
            <p className="text-sm text-storm-navy/60">No library items yet.</p>
          )}
        </ul>
        {busy && (
          <p className="mt-2 flex items-center gap-2 text-sm text-storm-navy/60">
            <Loader2 className="h-4 w-4 animate-spin" />
            Working…
          </p>
        )}
      </section>
    </div>
  );
}
