import type { AiSourceAssetKind } from "@prisma/client";
import { parseYouTubeVideoId } from "@/lib/video/youtube";
import type { LibraryAssetListItem } from "@/lib/actions/library";

export type LibraryFolderId =
  | "documents"
  | "images"
  | "videos"
  | "audio"
  | "links";

export type LibraryUploadType =
  | "document"
  | "image"
  | "video"
  | "audio"
  | "link"
  | "text";

export const LIBRARY_FOLDERS: {
  id: LibraryFolderId;
  label: string;
  kinds: AiSourceAssetKind[];
}[] = [
  { id: "documents", label: "Documents", kinds: ["pdf", "pptx", "text"] },
  { id: "images", label: "Images", kinds: ["image"] },
  { id: "videos", label: "Videos", kinds: ["video"] },
  { id: "audio", label: "Audio", kinds: ["audio"] },
  { id: "links", label: "Links", kinds: ["webpage", "embed"] },
];

export const LIBRARY_UPLOAD_TYPES: {
  id: LibraryUploadType;
  label: string;
  description: string;
  accept?: string;
  multiple?: boolean;
}[] = [
  {
    id: "document",
    label: "Document",
    description: "PDF, PowerPoint, or text files",
    accept: ".pdf,.pptx,.ppt,.txt,.md",
    multiple: true,
  },
  {
    id: "image",
    label: "Image",
    description: "Photos and graphics",
    accept: ".png,.jpg,.jpeg,.gif,.webp",
    multiple: true,
  },
  {
    id: "video",
    label: "Video",
    description: "Video files or YouTube links",
    accept: ".mp4,.mov,.webm",
    multiple: true,
  },
  {
    id: "audio",
    label: "Audio",
    description: "Recordings and audio files",
    accept: ".mp3,.wav,.m4a,.ogg",
    multiple: true,
  },
  {
    id: "link",
    label: "Web link",
    description: "Articles and web pages (not YouTube)",
  },
  {
    id: "text",
    label: "Text note",
    description: "Paste text directly",
  },
];

export const MAX_LIBRARY_BATCH_UPLOAD = 15;

export function folderForKind(kind: string): LibraryFolderId {
  const folder = LIBRARY_FOLDERS.find((f) =>
    (f.kinds as string[]).includes(kind),
  );
  return folder?.id ?? "documents";
}

export function assetFolder(
  asset: Pick<LibraryAssetListItem, "kind" | "blobUrl">,
): LibraryFolderId {
  if (asset.blobUrl && parseYouTubeVideoId(asset.blobUrl)) return "videos";
  return folderForKind(asset.kind);
}

export function assetInFolder(
  asset: Pick<LibraryAssetListItem, "kind" | "blobUrl">,
  folderId: LibraryFolderId,
): boolean {
  return assetFolder(asset) === folderId;
}

export function folderUploadType(
  folderId: LibraryFolderId,
): LibraryUploadType {
  const map: Record<LibraryFolderId, LibraryUploadType> = {
    documents: "document",
    images: "image",
    videos: "video",
    audio: "audio",
    links: "link",
  };
  return map[folderId];
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10_240 ? 1 : 0)} KB`;
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function assetDisplaySize(
  asset: Pick<LibraryAssetListItem, "kind" | "fileSizeBytes" | "blobUrl">,
): string {
  if (asset.fileSizeBytes != null) return formatFileSize(asset.fileSizeBytes);
  if (asset.kind === "webpage" || asset.kind === "embed") return "Link";
  if (asset.kind === "text") return "Text";
  if (asset.blobUrl && parseYouTubeVideoId(asset.blobUrl)) return "YouTube";
  return "—";
}

export function assetPreviewThumbnail(
  asset: Pick<
    LibraryAssetListItem,
    "kind" | "blobUrl" | "muxPlaybackId" | "title"
  >,
): string | null {
  if (asset.kind === "image" && asset.blobUrl) return asset.blobUrl;
  if (asset.blobUrl) {
    const yt = parseYouTubeVideoId(asset.blobUrl);
    if (yt) return `https://img.youtube.com/vi/${yt}/mqdefault.jpg`;
  }
  if (asset.muxPlaybackId) {
    return `https://image.mux.com/${asset.muxPlaybackId}/thumbnail.jpg?time=1`;
  }
  return null;
}

export function titleFromFilename(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, "").trim();
  return base || filename;
}

export function uniquifyTitles(titles: string[]): string[] {
  const seen = new Map<string, number>();
  return titles.map((title) => {
    const lower = title.toLowerCase();
    const count = seen.get(lower) ?? 0;
    seen.set(lower, count + 1);
    if (count === 0) return title;
    return `${title} (${count + 1})`;
  });
}

export function validateUniqueDescriptions(descriptions: string[]): string | null {
  const normalized = descriptions.map((d) => d.trim().toLowerCase());
  const seen = new Set<string>();
  for (const d of normalized) {
    if (!d) return "Each item needs a description for AI course placement.";
    if (seen.has(d)) {
      return "Each item needs a unique description so AI can tell them apart.";
    }
    seen.add(d);
  }
  return null;
}
