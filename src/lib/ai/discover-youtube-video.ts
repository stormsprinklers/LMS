import { AI_GENERATION_MODEL, requireOpenAI } from "./openai-client";
import { isYouTubeUrl, parseYouTubeVideoId } from "@/lib/video/youtube";

export type DiscoveredYoutubeVideo = {
  url: string;
  title: string;
  transcript: string;
};

type YoutubeSearchHit = {
  videoId: string;
  title: string;
  description: string;
};

async function fetchYoutubeOembedTitle(url: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
      { signal: AbortSignal.timeout(10_000) },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { title?: string };
    return data.title?.trim() || null;
  } catch {
    return null;
  }
}

export async function searchYouTubeVideos(
  query: string,
  maxResults = 6,
): Promise<YoutubeSearchHit[]> {
  const key = process.env.YOUTUBE_API_KEY?.trim();
  if (!key || !query.trim()) return [];

  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("type", "video");
  url.searchParams.set("maxResults", String(Math.min(maxResults, 10)));
  url.searchParams.set("q", query.trim());
  url.searchParams.set("key", key);
  url.searchParams.set("videoEmbeddable", "true");
  url.searchParams.set("safeSearch", "moderate");
  url.searchParams.set("relevanceLanguage", "en");

  try {
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      items?: {
        id?: { videoId?: string };
        snippet?: { title?: string; description?: string };
      }[];
    };
    const hits: YoutubeSearchHit[] = [];
    for (const item of data.items ?? []) {
      const videoId = item.id?.videoId;
      if (!videoId || !parseYouTubeVideoId(videoId)) continue;
      hits.push({
        videoId,
        title: item.snippet?.title?.trim() || "YouTube video",
        description: item.snippet?.description?.trim() || "",
      });
    }
    return hits;
  } catch {
    return [];
  }
}

async function buildYoutubeSearchQuery(options: {
  courseTitle: string;
  moduleTitle: string;
  itemTitle: string;
  outline?: string;
  userPrompt?: string;
}): Promise<string> {
  const openai = requireOpenAI();
  const completion = await openai.chat.completions.create({
    model: AI_GENERATION_MODEL,
    messages: [
      {
        role: "system",
        content:
          "You write short YouTube search queries (3–8 words) to find educational training videos. Reply with JSON: { \"query\": string }.",
      },
      {
        role: "user",
        content: [
          `Course: ${options.courseTitle}`,
          `Module: ${options.moduleTitle}`,
          `Video lesson: ${options.itemTitle}`,
          options.outline ? `Outline: ${options.outline}` : "",
          options.userPrompt ? `Author notes: ${options.userPrompt}` : "",
          "Return a query suitable for finding a relevant, professional training video.",
        ]
          .filter(Boolean)
          .join("\n"),
      },
    ],
    max_tokens: 80,
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) return options.itemTitle;
  try {
    const parsed = JSON.parse(raw) as { query?: string };
    const q = parsed.query?.trim();
    return q || options.itemTitle;
  } catch {
    return options.itemTitle;
  }
}

async function pickBestYoutubeCandidate(
  candidates: YoutubeSearchHit[],
  context: { itemTitle: string; outline?: string },
): Promise<YoutubeSearchHit | null> {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  const openai = requireOpenAI();
  const listing = candidates
    .map(
      (c, i) =>
        `${i}: ${c.title}\n${c.description.slice(0, 240)}`,
    )
    .join("\n\n");

  const completion = await openai.chat.completions.create({
    model: AI_GENERATION_MODEL,
    messages: [
      {
        role: "system",
        content:
          'Pick the best educational YouTube video for workplace training. Prefer clear instructional content over entertainment. Reply JSON: { "index": number }.',
      },
      {
        role: "user",
        content: `Lesson: ${context.itemTitle}\n${context.outline ? `Outline: ${context.outline}\n` : ""}\nCandidates:\n${listing}`,
      },
    ],
    max_tokens: 40,
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) return candidates[0];
  try {
    const parsed = JSON.parse(raw) as { index?: number };
    const idx = parsed.index;
    if (typeof idx === "number" && idx >= 0 && idx < candidates.length) {
      return candidates[idx];
    }
  } catch {
    // fall through
  }
  return candidates[0];
}

async function suggestYoutubeUrlViaLlm(options: {
  courseTitle: string;
  itemTitle: string;
  outline?: string;
  userPrompt?: string;
}): Promise<string | null> {
  const openai = requireOpenAI();
  const completion = await openai.chat.completions.create({
    model: AI_GENERATION_MODEL,
    messages: [
      {
        role: "system",
        content:
          "Suggest one real, embeddable YouTube watch URL for educational workplace training. Use only well-known public videos you are confident exist. Reply JSON: { \"youtubeUrl\": string }.",
      },
      {
        role: "user",
        content: [
          `Course: ${options.courseTitle}`,
          `Topic: ${options.itemTitle}`,
          options.outline ? `Outline: ${options.outline}` : "",
          options.userPrompt ? `Notes: ${options.userPrompt}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      },
    ],
    max_tokens: 120,
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { youtubeUrl?: string };
    const url = parsed.youtubeUrl?.trim();
    if (url && isYouTubeUrl(url)) return url;
  } catch {
    return null;
  }
  return null;
}

async function buildTranscriptSummary(options: {
  videoTitle: string;
  itemTitle: string;
  outline?: string;
}): Promise<string> {
  const openai = requireOpenAI();
  const completion = await openai.chat.completions.create({
    model: AI_GENERATION_MODEL,
    messages: [
      {
        role: "system",
        content:
          "Write a 2–3 sentence summary for trainers describing what learners will see in this video. Plain text only.",
      },
      {
        role: "user",
        content: `Lesson: ${options.itemTitle}\nVideo: ${options.videoTitle}\n${options.outline ? `Outline: ${options.outline}` : ""}`,
      },
    ],
    max_tokens: 180,
  });
  return completion.choices[0]?.message?.content?.trim() || options.videoTitle;
}

/** Find a relevant public YouTube video for a VIDEO blueprint item. */
export async function discoverYoutubeVideoForItem(options: {
  courseTitle: string;
  moduleTitle: string;
  itemTitle: string;
  outline?: string;
  userPrompt?: string;
}): Promise<DiscoveredYoutubeVideo | null> {
  const query = await buildYoutubeSearchQuery(options);
  const hits = await searchYouTubeVideos(query);

  let picked: YoutubeSearchHit | null = null;
  if (hits.length > 0) {
    picked = await pickBestYoutubeCandidate(hits, {
      itemTitle: options.itemTitle,
      outline: options.outline,
    });
  }

  let url: string | null = picked
    ? `https://www.youtube.com/watch?v=${picked.videoId}`
    : null;

  if (!url) {
    url = await suggestYoutubeUrlViaLlm({
      courseTitle: options.courseTitle,
      itemTitle: options.itemTitle,
      outline: options.outline,
      userPrompt: options.userPrompt,
    });
  }

  if (!url || !isYouTubeUrl(url)) return null;

  const oembedTitle = await fetchYoutubeOembedTitle(url);
  const title = oembedTitle || picked?.title || options.itemTitle;
  const transcript = await buildTranscriptSummary({
    videoTitle: title,
    itemTitle: options.itemTitle,
    outline: options.outline,
  });

  return { url, title, transcript };
}
