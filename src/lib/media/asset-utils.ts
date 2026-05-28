import type { AiSourceAssetKind } from "@prisma/client";

export const MAX_MEDIA_FILE_BYTES = 80 * 1024 * 1024;

export function kindFromMime(mime: string, filename: string): AiSourceAssetKind {
  const lower = filename.toLowerCase();
  if (mime.includes("pdf") || lower.endsWith(".pdf")) return "pdf";
  if (
    mime.includes("presentation") ||
    lower.endsWith(".pptx") ||
    lower.endsWith(".ppt")
  ) {
    return "pptx";
  }
  if (mime.startsWith("audio/") || /\.(mp3|wav|m4a|ogg)$/i.test(lower)) return "audio";
  if (mime.startsWith("video/") || /\.(mp4|mov|webm)$/i.test(lower)) return "video";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("text/") || lower.endsWith(".txt") || lower.endsWith(".md")) {
    return "text";
  }
  return "text";
}

export function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export const LIBRARY_FILE_ACCEPT =
  ".pdf,.pptx,.ppt,.mp3,.wav,.m4a,.mp4,.mov,.webm,.png,.jpg,.jpeg,.gif,.webp,.txt,.md";

export function kindLabel(kind: string): string {
  const labels: Record<string, string> = {
    pdf: "PDF",
    pptx: "Presentation",
    text: "Text",
    audio: "Audio",
    video: "Video",
    image: "Image",
    embed: "Embed",
    webpage: "Web page",
  };
  return labels[kind] ?? kind;
}
