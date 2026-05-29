import { fetchWebpageTitle } from "@/lib/ai/fetch-webpage";
import { titleFromFilename } from "@/lib/library/folders";
import { isYouTubeUrl, parseYouTubeVideoId } from "@/lib/video/youtube";

export type ResolveLibraryTitleInput = {
  title?: string;
  pastedText?: string;
  sourceUrl?: string;
  urlKind?: "webpage" | "video";
  uploadedFilename?: string;
};

async function resolveTitleFromUrl(
  url: string,
  urlKind?: "webpage" | "video",
): Promise<string> {
  if (isYouTubeUrl(url) || urlKind === "video") {
    if (isYouTubeUrl(url)) {
      try {
        const res = await fetch(
          `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
          { signal: AbortSignal.timeout(10_000) },
        );
        if (res.ok) {
          const data = (await res.json()) as { title?: string };
          if (data.title?.trim()) return data.title.trim();
        }
      } catch {
        // fall through
      }
      const id = parseYouTubeVideoId(url);
      return id ? `YouTube video ${id}` : "YouTube video";
    }
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return "Video link";
    }
  }

  try {
    const pageTitle = await fetchWebpageTitle(url);
    if (pageTitle) return pageTitle;
  } catch {
    // fall through
  }

  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Web page";
  }
}

export async function resolveLibraryTitle(
  input: ResolveLibraryTitleInput,
): Promise<string> {
  const trimmed = input.title?.trim();
  if (trimmed) return trimmed;

  const filename = input.uploadedFilename?.trim();
  if (filename) return titleFromFilename(filename);

  const pastedText = input.pastedText?.trim();
  if (pastedText) {
    const firstLine = pastedText.split(/\n/)[0]?.trim() ?? "";
    return firstLine.slice(0, 120) || "Text note";
  }

  const sourceUrl = input.sourceUrl?.trim();
  if (sourceUrl) return resolveTitleFromUrl(sourceUrl, input.urlKind);

  return "Untitled";
}
