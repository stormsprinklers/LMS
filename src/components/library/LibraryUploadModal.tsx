"use client";

import { useEffect, useMemo, useState } from "react";
import { upload } from "@vercel/blob/client";
import type { LibraryAssetScope } from "@prisma/client";
import {
  LIBRARY_UPLOAD_TYPES,
  MAX_LIBRARY_BATCH_UPLOAD,
  titleFromFilename,
  uniquifyTitles,
  validateUniqueDescriptions,
  type LibraryUploadType,
} from "@/lib/library/folders";
import { fetchLibraryTags, saveLibraryAssetsBatch } from "@/lib/library/client";
import type { LibraryTagListItem } from "@/lib/library/types";
import { LibraryTagDropdown } from "@/components/library/LibraryTagDropdown";
import type { LibraryCreateInput } from "@/lib/library/create-assets";
import { uploadLibraryFileToBlob } from "@/lib/library/upload-client";
import { formatBlobUploadError } from "@/lib/media/blob-config";
import { FileInput } from "@/components/ui/FileInput";
import { isYouTubeUrl } from "@/lib/video/youtube";
import {
  FileText,
  Globe,
  Image as ImageIcon,
  Loader2,
  Music,
  Plus,
  Video,
  X,
} from "lucide-react";

const TYPE_ICONS: Record<LibraryUploadType, React.ReactNode> = {
  document: <FileText className="h-6 w-6" />,
  image: <ImageIcon className="h-6 w-6" />,
  video: <Video className="h-6 w-6" />,
  audio: <Music className="h-6 w-6" />,
  link: <Globe className="h-6 w-6" />,
  text: <FileText className="h-6 w-6" />,
};

type FileEntry = {
  key: string;
  file: File;
  title: string;
  description: string;
  tagIds: string[];
};

function fileKey(file: File): string {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

export function LibraryUploadModal({
  open,
  onClose,
  canPublishShared,
  onComplete,
  initialUploadType = null,
}: {
  open: boolean;
  onClose: () => void;
  canPublishShared: boolean;
  onComplete: () => void;
  initialUploadType?: LibraryUploadType | null;
}) {
  const [step, setStep] = useState<"type" | "form">("type");
  const [uploadType, setUploadType] = useState<LibraryUploadType | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");

  const [description, setDescription] = useState("");
  const [scope, setScope] = useState<LibraryAssetScope>("shared");
  const [title, setTitle] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [fileEntries, setFileEntries] = useState<FileEntry[]>([]);
  const [sourceUrl, setSourceUrl] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [includeRecording, setIncludeRecording] = useState(true);
  const [videoMode, setVideoMode] = useState<"files" | "link">("files");
  const [availableTags, setAvailableTags] = useState<LibraryTagListItem[]>([]);
  const [sharedTagIds, setSharedTagIds] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    void fetchLibraryTags().then((r) => {
      if (r.tags) setAvailableTags(r.tags);
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setSharedTagIds([]);
    setError("");
    setProgress("");
    setDescription("");
    setScope(canPublishShared ? "shared" : "personal");
    setTitle("");
    setFiles([]);
    setFileEntries([]);
    setSourceUrl("");
    setPasteText("");
    setIncludeRecording(true);

    if (initialUploadType) {
      setUploadType(initialUploadType);
      setStep("form");
      setVideoMode(initialUploadType === "video" ? "link" : "files");
    } else {
      setStep("type");
      setUploadType(null);
      setVideoMode("files");
    }
  }, [open, canPublishShared, initialUploadType]);

  useEffect(() => {
    setFileEntries((prev) => {
      const prevByKey = new Map(prev.map((entry) => [entry.key, entry]));
      return files.map((file) => {
        const key = fileKey(file);
        const existing = prevByKey.get(key);
        if (existing) return { ...existing, file };
        return {
          key,
          file,
          title: titleFromFilename(file.name),
          description: "",
          tagIds: [],
        };
      });
    });
  }, [files]);

  const typeConfig = LIBRARY_UPLOAD_TYPES.find((t) => t.id === uploadType);
  const isMultiFile =
    typeConfig?.multiple &&
    !(uploadType === "video" && videoMode === "link");
  const usesPerFileMetadata = isMultiFile && files.length > 0;

  const resolvedPreviewTitles = useMemo(() => {
    if (!usesPerFileMetadata) return [];
    return uniquifyTitles(
      fileEntries.map((entry) => entry.title.trim() || titleFromFilename(entry.file.name)),
    );
  }, [fileEntries, usesPerFileMetadata]);

  if (!open) return null;

  function close() {
    if (busy) return;
    onClose();
  }

  function pickType(id: LibraryUploadType) {
    setUploadType(id);
    setStep("form");
    setVideoMode(id === "video" ? "link" : "files");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadType) return;

    setBusy(true);
    setError("");
    setProgress("");

    try {
      const items: LibraryCreateInput[] = [];

      if (uploadType === "text") {
        if (!pasteText.trim()) {
          setError("Paste some text to upload.");
          return;
        }
        if (!description.trim()) {
          setError("Description is required for AI course placement.");
          return;
        }
        items.push({
          title: title.trim() || undefined,
          description: description.trim(),
          scope,
          pastedText: pasteText.trim(),
        });
      } else if (uploadType === "link" || (uploadType === "video" && videoMode === "link")) {
        if (!sourceUrl.trim()) {
          setError("Enter a URL.");
          return;
        }
        if (!description.trim()) {
          setError("Description is required for AI course placement.");
          return;
        }
        if (uploadType === "link" && isYouTubeUrl(sourceUrl.trim())) {
          setError('YouTube links belong under Video. Choose "Video" → "YouTube / link".');
          return;
        }
        const asVideo = uploadType === "video";
        items.push({
          title: title.trim() || undefined,
          description: description.trim(),
          scope,
          sourceUrl: sourceUrl.trim(),
          urlKind: asVideo ? "video" : "webpage",
          includeRecording: asVideo ? includeRecording : false,
        });
      } else {
        if (files.length === 0) {
          setError("Choose at least one file.");
          return;
        }
        if (files.length > MAX_LIBRARY_BATCH_UPLOAD) {
          setError(`Maximum ${MAX_LIBRARY_BATCH_UPLOAD} files at a time.`);
          return;
        }

        const descriptionError = validateUniqueDescriptions(
          fileEntries.map((entry) => entry.description),
        );
        if (descriptionError) {
          setError(descriptionError);
          return;
        }

        for (let i = 0; i < fileEntries.length; i++) {
          const entry = fileEntries[i];
          const file = entry.file;
          setProgress(`Uploading ${i + 1} of ${fileEntries.length}: ${file.name}`);

          let blobUrl: string;
          let filename: string;
          let mimeType: string;
          let fileSizeBytes: number;

          try {
            const uploaded = await uploadLibraryFileToBlob(file);
            blobUrl = uploaded.blobUrl;
            filename = uploaded.filename;
            mimeType = uploaded.mimeType;
            fileSizeBytes = uploaded.fileSizeBytes;
          } catch {
            const blob = await upload(`library/${file.name}`, file, {
              access: "public",
              handleUploadUrl: "/api/library/upload",
            });
            blobUrl = blob.url;
            filename = file.name;
            mimeType = file.type || "";
            fileSizeBytes = file.size;
          }

          items.push({
            title: entry.title.trim() || undefined,
            description: entry.description.trim(),
            scope,
            blobUrl,
            uploadedFilename: filename,
            uploadedMimeType: mimeType,
            fileSizeBytes,
            includeRecording: uploadType === "video" ? includeRecording : false,
            tagIds: entry.tagIds.length ? entry.tagIds : undefined,
          });
        }
      }

      setProgress("Saving to library…");
      const result = await saveLibraryAssetsBatch(items, scope, sharedTagIds);
      if (result.error && !result.created) {
        setError(result.error);
        return;
      }
      onComplete();
      close();
    } catch (err) {
      setError(formatBlobUploadError(err));
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  function updateFileEntry(
    key: string,
    patch: Partial<Pick<FileEntry, "title" | "description" | "tagIds">>,
  ) {
    setFileEntries((prev) =>
      prev.map((entry) => (entry.key === key ? { ...entry, ...patch } : entry)),
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Upload to library"
      onClick={close}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-4 py-3 sm:px-6">
          <h2 className="font-title text-lg font-semibold text-storm-navy">
            {step === "type" ? "Upload" : typeConfig?.label ?? "Upload"}
          </h2>
          <button
            type="button"
            onClick={close}
            disabled={busy}
            className="rounded-lg p-2 text-storm-navy/60 hover:bg-storm-light-grey/60"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {step === "type" && (
          <div className="grid grid-cols-2 gap-3 p-4 sm:p-6">
            {LIBRARY_UPLOAD_TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => pickType(t.id)}
                className="flex flex-col items-start rounded-lg border border-storm-light-blue/50 p-4 text-left hover:border-storm-medium-blue hover:bg-storm-light-blue/10"
              >
                <span className="text-storm-medium-blue">{TYPE_ICONS[t.id]}</span>
                <span className="mt-2 font-medium text-storm-navy">{t.label}</span>
                <span className="mt-1 text-xs text-storm-navy/60">{t.description}</span>
              </button>
            ))}
          </div>
        )}

        {step === "form" && uploadType && (
          <form onSubmit={handleSubmit} className="space-y-4 p-4 sm:p-6">
            <button
              type="button"
              onClick={() => setStep("type")}
              disabled={busy}
              className="text-sm text-storm-medium-blue hover:underline"
            >
              ← Change type
            </button>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                {error}
              </div>
            )}

            {(uploadType === "link" ||
              uploadType === "text" ||
              (uploadType === "video" && videoMode === "link")) && (
              <label className="block text-sm">
                <span className="font-medium text-storm-navy">Title</span>
                <span className="ml-1 text-storm-navy/50">(optional)</span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-storm-light-blue/60 px-3 py-2"
                  placeholder={
                    uploadType === "text"
                      ? "Uses first line of text if blank"
                      : uploadType === "video"
                        ? "Uses YouTube or video title if blank"
                        : "Uses page title if blank"
                  }
                />
              </label>
            )}

            {!usesPerFileMetadata && (
              <label className="block text-sm">
                <span className="font-medium text-storm-navy">Description</span>
                <textarea
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-storm-light-blue/60 px-3 py-2"
                  placeholder="What this is and where AI should use it in courses…"
                />
                <span className="mt-1 block text-xs text-storm-navy/55">
                  AI uses this to decide which courses and lessons to place this in.
                </span>
              </label>
            )}

            {canPublishShared && (
              <label className="block text-sm">
                <span className="font-medium text-storm-navy">Visibility</span>
                <select
                  value={scope}
                  onChange={(e) => setScope(e.target.value as LibraryAssetScope)}
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                >
                  <option value="shared">Shared (whole team)</option>
                  <option value="personal">Personal (only me)</option>
                </select>
              </label>
            )}

            {availableTags.length > 0 && !usesPerFileMetadata && (
              <LibraryTagDropdown
                mode="multiple"
                tags={availableTags}
                value={sharedTagIds}
                onChange={setSharedTagIds}
                disabled={busy}
                label="Tags (optional)"
                placement="top"
              />
            )}

            {uploadType === "video" && (
              <div className="flex gap-2 text-sm">
                <button
                  type="button"
                  onClick={() => setVideoMode("files")}
                  className={`rounded-full px-3 py-1 ${
                    videoMode === "files"
                      ? "bg-storm-medium-blue text-white"
                      : "bg-storm-light-grey/60"
                  }`}
                >
                  Upload files
                </button>
                <button
                  type="button"
                  onClick={() => setVideoMode("link")}
                  className={`rounded-full px-3 py-1 ${
                    videoMode === "link"
                      ? "bg-storm-medium-blue text-white"
                      : "bg-storm-light-grey/60"
                  }`}
                >
                  YouTube / link
                </button>
              </div>
            )}

            {isMultiFile && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-storm-navy">
                  Files (up to {MAX_LIBRARY_BATCH_UPLOAD})
                </label>
                <FileInput
                  multiple
                  accept={typeConfig?.accept}
                  onChange={(e) => {
                    const list = e.target.files;
                    if (!list) return;
                    setFiles(Array.from(list).slice(0, MAX_LIBRARY_BATCH_UPLOAD));
                  }}
                />
              </div>
            )}

            {availableTags.length > 0 && usesPerFileMetadata && (
              <LibraryTagDropdown
                mode="multiple"
                tags={availableTags}
                value={sharedTagIds}
                onChange={setSharedTagIds}
                disabled={busy}
                label="Tags for all items (optional)"
                placement="top"
              />
            )}

            {usesPerFileMetadata && (
              <div className="space-y-3">
                <p className="text-sm text-storm-navy/70">
                  Add a unique description for each file. Titles default to the file name. Use shared
                  tags above plus any additional tags per file.
                </p>
                <div className="max-h-72 space-y-3 overflow-y-auto rounded-lg border border-storm-light-blue/40 p-2">
                  {fileEntries.map((entry, index) => (
                    <div
                      key={entry.key}
                      className="space-y-2 rounded-lg bg-storm-light-grey/25 p-3"
                    >
                      <p className="truncate text-xs font-medium text-storm-navy">
                        {entry.file.name}
                      </p>
                      <label className="block text-xs">
                        <span className="font-medium text-storm-navy">Title</span>
                        <span className="text-storm-navy/50"> (optional)</span>
                        <input
                          value={entry.title}
                          onChange={(e) =>
                            updateFileEntry(entry.key, { title: e.target.value })
                          }
                          placeholder={resolvedPreviewTitles[index] ?? titleFromFilename(entry.file.name)}
                          className="mt-1 w-full rounded-lg border border-storm-light-blue/60 px-2 py-1.5 text-sm"
                        />
                      </label>
                      <label className="block text-xs">
                        <span className="font-medium text-storm-navy">Description</span>
                        <textarea
                          required
                          value={entry.description}
                          onChange={(e) =>
                            updateFileEntry(entry.key, { description: e.target.value })
                          }
                          rows={2}
                          placeholder="What this file is and where AI should use it…"
                          className="mt-1 w-full rounded-lg border border-storm-light-blue/60 px-2 py-1.5 text-sm"
                        />
                      </label>
                      {availableTags.length > 0 && (
                        <LibraryTagDropdown
                          mode="multiple"
                          tags={availableTags}
                          value={entry.tagIds}
                          onChange={(tagIds) => updateFileEntry(entry.key, { tagIds })}
                          disabled={busy}
                          label="Additional tags (optional)"
                          placement="top"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(uploadType === "link" ||
              (uploadType === "video" && videoMode === "link")) && (
              <>
                <label className="block text-sm">
                  <span className="font-medium text-storm-navy">URL</span>
                  <input
                    type="url"
                    required
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    className="mt-1 w-full rounded-lg border px-3 py-2"
                    placeholder={
                      uploadType === "video"
                        ? "https://www.youtube.com/watch?v=…"
                        : "https://…"
                    }
                  />
                </label>
                {uploadType === "link" && (
                  <p className="text-xs text-storm-navy/60">
                    For YouTube or other video links, use{" "}
                    <button
                      type="button"
                      onClick={() => pickType("video")}
                      className="font-medium text-storm-medium-blue hover:underline"
                    >
                      Video → YouTube / link
                    </button>
                    .
                  </p>
                )}
              </>
            )}

            {uploadType === "text" && (
              <label className="block text-sm">
                <span className="font-medium text-storm-navy">Text</span>
                <textarea
                  required
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  rows={6}
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                />
              </label>
            )}

            {uploadType === "video" && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={includeRecording}
                  onChange={(e) => setIncludeRecording(e.target.checked)}
                />
                Keep video for course playback (Mux)
              </label>
            )}

            {progress && (
              <p className="flex items-center gap-2 text-sm text-storm-navy/70">
                <Loader2 className="h-4 w-4 animate-spin" />
                {progress}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-storm-medium-blue text-sm font-medium text-white disabled:opacity-50"
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploading…
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Add to library
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
