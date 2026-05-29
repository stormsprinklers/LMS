import { prisma } from "@/lib/db";
import { isYouTubeUrl } from "@/lib/video/youtube";

const MIME_EXT: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "video/mp4": ".mp4",
  "video/quicktime": ".mov",
  "video/webm": ".webm",
  "audio/mpeg": ".mp3",
  "audio/wav": ".wav",
  "audio/mp4": ".m4a",
  "text/plain": ".txt",
};

function sanitizeFilename(name: string): string {
  const cleaned = name.replace(/[^\w.\-() ]+/g, "_").trim();
  return cleaned.slice(0, 200) || "download";
}

export function libraryDownloadFilename(asset: {
  filename: string | null;
  title: string;
  mimeType: string | null;
  kind: string;
}): string {
  if (asset.filename?.trim()) {
    return sanitizeFilename(asset.filename.trim());
  }

  const ext =
    (asset.mimeType && MIME_EXT[asset.mimeType]) ||
    (asset.kind === "pdf"
      ? ".pdf"
      : asset.kind === "image"
        ? ".jpg"
        : asset.kind === "video"
          ? ".mp4"
          : asset.kind === "audio"
            ? ".mp3"
            : "");

  return sanitizeFilename(`${asset.title}${ext}`);
}

export async function getLibraryAssetForDownload(userId: string, assetId: string) {
  const asset = await prisma.libraryAsset.findFirst({
    where: {
      id: assetId,
      archived: false,
      OR: [{ scope: "shared" }, { createdById: userId }],
    },
  });

  if (!asset?.blobUrl) return null;
  if (asset.kind === "webpage" || isYouTubeUrl(asset.blobUrl)) return null;

  return asset;
}

export async function fetchLibraryAssetBlob(blobUrl: string) {
  const res = await fetch(blobUrl, { redirect: "follow" });
  if (!res.ok) {
    throw new Error(`Could not fetch file (${res.status}).`);
  }
  return res;
}
