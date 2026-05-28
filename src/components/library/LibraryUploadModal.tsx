"use client";

import { useEffect, useState } from "react";
import { upload } from "@vercel/blob/client";
import type { LibraryAssetScope } from "@prisma/client";
import {
  LIBRARY_UPLOAD_TYPES,
  MAX_LIBRARY_BATCH_UPLOAD,
  titleFromFilename,
  type LibraryUploadType,
} from "@/lib/library/folders";
import { saveLibraryAssetsBatch } from "@/lib/library/client";
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

export function LibraryUploadModal({
  open,
  onClose,
  canPublishShared,
  onComplete,
}: {
  open: boolean;
  onClose: () => void;
  canPublishShared: boolean;
  onComplete: () => void;
}) {
  const [step, setStep] = useState<"type" | "form">("type");
  const [uploadType, setUploadType] = useState<LibraryUploadType | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");

  const [description, setDescription] = useState("");
  const [scope, setScope] = useState<LibraryAssetScope>("personal");
  const [title, setTitle] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [sourceUrl, setSourceUrl] = useState("");
  const [urlKind, setUrlKind] = useState<"webpage" | "video">("webpage");
  const [pasteText, setPasteText] = useState("");
  const [includeRecording, setIncludeRecording] = useState(true);
  const [videoMode, setVideoMode] = useState<"files" | "link">("files");

  useEffect(() => {
    if (!open) return;
    setStep("type");
    setUploadType(null);
    setError("");
    setProgress("");
    setDescription("");
    setScope("personal");
    setTitle("");
    setFiles([]);
    setSourceUrl("");
    setUrlKind("webpage");
    setPasteText("");
    setIncludeRecording(true);
    setVideoMode("files");
  }, [open]);

  if (!open) return null;

  const typeConfig = LIBRARY_UPLOAD_TYPES.find((t) => t.id === uploadType);
  const isMultiFile =
    typeConfig?.multiple &&
    !(uploadType === "video" && videoMode === "link");

  function close() {
    if (busy) return;
    onClose();
  }

  function pickType(id: LibraryUploadType) {
    setUploadType(id);
    setStep("form");
    if (id === "video") setVideoMode("files");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadType) return;
    if (!description.trim()) {
      setError("Description is required.");
      return;
    }

    setBusy(true);
    setError("");
    setProgress("");

    try {
      const items: LibraryCreateInput[] = [];

      if (uploadType === "text") {
        if (!title.trim()) {
          setError("Title is required.");
          return;
        }
        if (!pasteText.trim()) {
          setError("Paste some text to upload.");
          return;
        }
        items.push({
          title: title.trim(),
          description: description.trim(),
          scope,
          pastedText: pasteText.trim(),
        });
      } else if (uploadType === "link" || (uploadType === "video" && videoMode === "link")) {
        if (!title.trim()) {
          setError("Title is required.");
          return;
        }
        if (!sourceUrl.trim()) {
          setError("Enter a URL.");
          return;
        }
        const asVideo =
          uploadType === "video" || urlKind === "video" || isYouTubeUrl(sourceUrl);
        items.push({
          title: title.trim(),
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

        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          setProgress(`Uploading ${i + 1} of ${files.length}: ${file.name}`);

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
            title: titleFromFilename(file.name),
            description: description.trim(),
            scope,
            blobUrl,
            uploadedFilename: filename,
            uploadedMimeType: mimeType,
            fileSizeBytes,
            includeRecording: uploadType === "video" ? includeRecording : false,
          });
        }
      }

      setProgress("Saving to library…");
      const result = await saveLibraryAssetsBatch(items, scope);
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
                <input
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-storm-light-blue/60 px-3 py-2"
                />
              </label>
            )}

            <label className="block text-sm">
              <span className="font-medium text-storm-navy">Description</span>
              <textarea
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-storm-light-blue/60 px-3 py-2"
                placeholder="What this is and how to use it…"
              />
            </label>

            {canPublishShared && (
              <label className="block text-sm">
                <span className="font-medium text-storm-navy">Visibility</span>
                <select
                  value={scope}
                  onChange={(e) => setScope(e.target.value as LibraryAssetScope)}
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                >
                  <option value="personal">Personal (only me)</option>
                  <option value="shared">Shared (whole team)</option>
                </select>
              </label>
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
                {files.length > 0 && (
                  <ul className="max-h-32 overflow-y-auto rounded border text-xs">
                    {files.map((f) => (
                      <li
                        key={`${f.name}-${f.size}`}
                        className="flex justify-between border-b px-2 py-1 last:border-0"
                      >
                        <span className="truncate">{f.name}</span>
                        <span className="shrink-0 text-storm-navy/50">
                          {(f.size / 1024).toFixed(0)} KB
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {(uploadType === "link" ||
              (uploadType === "video" && videoMode === "link")) && (
              <>
                <label className="block text-sm">
                  <span className="font-medium text-storm-navy">URL</span>
                  <input
                    type="url"
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    className="mt-1 w-full rounded-lg border px-3 py-2"
                    placeholder="https://…"
                  />
                </label>
                {uploadType === "link" && (
                  <div className="flex gap-4 text-sm">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={urlKind === "webpage"}
                        onChange={() => setUrlKind("webpage")}
                      />
                      Web page
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={urlKind === "video"}
                        onChange={() => setUrlKind("video")}
                      />
                      Video link
                    </label>
                  </div>
                )}
              </>
            )}

            {uploadType === "text" && (
              <label className="block text-sm">
                <span className="font-medium text-storm-navy">Text</span>
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  rows={6}
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                />
              </label>
            )}

            {uploadType === "video" &&
              (videoMode === "files" || urlKind === "video") && (
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
