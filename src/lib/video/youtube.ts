const YOUTUBE_ID = /^[\w-]{11}$/;

/** Extract a YouTube video ID from common URL formats, or return the id if already bare. */
export function parseYouTubeVideoId(input: string | null | undefined): string | null {
  if (!input?.trim()) return null;
  const value = input.trim();

  if (YOUTUBE_ID.test(value)) return value;

  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      const id = url.pathname.slice(1).split("/")[0];
      return id && YOUTUBE_ID.test(id) ? id : null;
    }

    if (host === "youtube.com" || host === "m.youtube.com") {
      const fromQuery = url.searchParams.get("v");
      if (fromQuery && YOUTUBE_ID.test(fromQuery)) return fromQuery;

      const pathMatch = url.pathname.match(/^\/(embed|shorts|live|v)\/([\w-]{11})/);
      if (pathMatch?.[2]) return pathMatch[2];
    }
  } catch {
    // fall through to regex
  }

  const match = value.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|shorts\/|live\/|watch\?v=|v\/))([\w-]{11})/,
  );
  return match?.[1] ?? null;
}

export function isYouTubeUrl(input: string | null | undefined): boolean {
  return parseYouTubeVideoId(input) !== null;
}

export function youtubeNoCookieEmbedUrl(videoId: string, startSeconds = 0): string {
  const params = new URLSearchParams({ rel: "0", modestbranding: "1" });
  if (startSeconds > 0) params.set("start", String(Math.floor(startSeconds)));
  return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
}
