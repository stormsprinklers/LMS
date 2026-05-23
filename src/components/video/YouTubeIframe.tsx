import { parseYouTubeVideoId, youtubeNoCookieEmbedUrl } from "@/lib/video/youtube";

export function YouTubeIframe({
  urlOrId,
  title = "YouTube video",
  startSeconds = 0,
  className = "aspect-video w-full border-0",
}: {
  urlOrId: string;
  title?: string;
  startSeconds?: number;
  className?: string;
}) {
  const videoId = parseYouTubeVideoId(urlOrId);
  if (!videoId) return null;

  return (
    <iframe
      title={title}
      src={youtubeNoCookieEmbedUrl(videoId, startSeconds)}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      referrerPolicy="strict-origin-when-cross-origin"
      allowFullScreen
      className={className}
    />
  );
}
