import { prisma } from "@/lib/db";
import type { AiSourceAsset } from "@prisma/client";
import { AI_GENERATION_MODEL, requireOpenAI } from "./openai-client";
import { isHttpUrl } from "@/lib/media/asset-utils";

export type DiscoveredImage = {
  url: string;
  title: string;
  caption: string;
};

type ImageSearchHit = {
  url: string;
  title: string;
  description: string;
};

function isLikelyImageUrl(url: string): boolean {
  if (!isHttpUrl(url)) return false;
  try {
    const path = new URL(url).pathname.toLowerCase();
    return (
      /\.(jpe?g|png|webp|gif)(\?|$)/i.test(path) ||
      path.includes("/thumb/") ||
      url.includes("images.unsplash.com") ||
      url.includes("images.pexels.com")
    );
  } catch {
    return false;
  }
}

async function buildImageSearchQuery(options: {
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
          'You write short image search queries (3–8 words) for professional workplace training photos. Reply JSON: { "query": string }.',
      },
      {
        role: "user",
        content: [
          `Course: ${options.courseTitle}`,
          `Module: ${options.moduleTitle}`,
          `Lesson: ${options.itemTitle}`,
          options.outline ? `Outline: ${options.outline}` : "",
          options.userPrompt ? `Author notes: ${options.userPrompt}` : "",
          "Return a query for a clear, relevant instructional photo (equipment, procedures, safety).",
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
    return parsed.query?.trim() || options.itemTitle;
  } catch {
    return options.itemTitle;
  }
}

async function searchUnsplash(query: string, maxResults = 6): Promise<ImageSearchHit[]> {
  const key = process.env.UNSPLASH_ACCESS_KEY?.trim();
  if (!key || !query.trim()) return [];

  const url = new URL("https://api.unsplash.com/search/photos");
  url.searchParams.set("query", query.trim());
  url.searchParams.set("per_page", String(Math.min(maxResults, 10)));
  url.searchParams.set("orientation", "landscape");

  try {
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Client-ID ${key}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      results?: {
        urls?: { regular?: string; small?: string };
        description?: string | null;
        alt_description?: string | null;
      }[];
    };
    const hits: ImageSearchHit[] = [];
    for (const item of data.results ?? []) {
      const imageUrl = item.urls?.regular ?? item.urls?.small;
      if (!imageUrl || !isLikelyImageUrl(imageUrl)) continue;
      hits.push({
        url: imageUrl,
        title:
          item.alt_description?.trim() ||
          item.description?.trim() ||
          "Training photo",
        description: item.description?.trim() || item.alt_description?.trim() || "",
      });
    }
    return hits;
  } catch {
    return [];
  }
}

async function searchPexels(query: string, maxResults = 6): Promise<ImageSearchHit[]> {
  const key = process.env.PEXELS_API_KEY?.trim();
  if (!key || !query.trim()) return [];

  const url = new URL("https://api.pexels.com/v1/search");
  url.searchParams.set("query", query.trim());
  url.searchParams.set("per_page", String(Math.min(maxResults, 10)));
  url.searchParams.set("orientation", "landscape");

  try {
    const res = await fetch(url.toString(), {
      headers: { Authorization: key },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      photos?: {
        src?: { large?: string; medium?: string };
        alt?: string;
      }[];
    };
    const hits: ImageSearchHit[] = [];
    for (const photo of data.photos ?? []) {
      const imageUrl = photo.src?.large ?? photo.src?.medium;
      if (!imageUrl || !isLikelyImageUrl(imageUrl)) continue;
      hits.push({
        url: imageUrl,
        title: photo.alt?.trim() || "Training photo",
        description: photo.alt?.trim() || "",
      });
    }
    return hits;
  } catch {
    return [];
  }
}

async function searchWikimediaCommons(
  query: string,
  maxResults = 6,
): Promise<ImageSearchHit[]> {
  if (!query.trim()) return [];

  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("format", "json");
  url.searchParams.set("generator", "search");
  url.searchParams.set("gsrsearch", query.trim());
  url.searchParams.set("gsrnamespace", "6");
  url.searchParams.set("gsrlimit", String(Math.min(maxResults, 10)));
  url.searchParams.set("prop", "imageinfo");
  url.searchParams.set("iiprop", "url|mime");
  url.searchParams.set("iiurlwidth", "1200");

  try {
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": "StormLMS/1.0 (course builder)" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      query?: {
        pages?: Record<
          string,
          {
            title?: string;
            imageinfo?: { url?: string; thumburl?: string; mime?: string }[];
          }
        >;
      };
    };
    const hits: ImageSearchHit[] = [];
    for (const page of Object.values(data.query?.pages ?? {})) {
      const info = page.imageinfo?.[0];
      const imageUrl = info?.thumburl ?? info?.url;
      if (!imageUrl || !isLikelyImageUrl(imageUrl)) continue;
      if (info?.mime && !info.mime.startsWith("image/")) continue;
      const title = (page.title ?? "Image").replace(/^File:/, "").replace(/_/g, " ");
      hits.push({
        url: imageUrl,
        title,
        description: title,
      });
    }
    return hits;
  } catch {
    return [];
  }
}

async function pickBestImageCandidate(
  candidates: ImageSearchHit[],
  context: { itemTitle: string; outline?: string },
): Promise<ImageSearchHit | null> {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  const openai = requireOpenAI();
  const listing = candidates
    .map((c, i) => `${i}: ${c.title}\n${c.description.slice(0, 200)}`)
    .join("\n\n");

  const completion = await openai.chat.completions.create({
    model: AI_GENERATION_MODEL,
    messages: [
      {
        role: "system",
        content:
          'Pick the best professional training photo for a workplace lesson. Prefer clear, instructional photos over generic stock. Reply JSON: { "index": number }.',
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

/** Find a relevant image URL for a LESSON blueprint item. */
export async function discoverImageForItem(options: {
  courseTitle: string;
  moduleTitle: string;
  itemTitle: string;
  outline?: string;
  userPrompt?: string;
}): Promise<DiscoveredImage | null> {
  const query = await buildImageSearchQuery(options);

  const hits = [
    ...(await searchUnsplash(query)),
    ...(await searchPexels(query)),
    ...(await searchWikimediaCommons(query)),
  ];

  const unique = new Map<string, ImageSearchHit>();
  for (const hit of hits) {
    if (!unique.has(hit.url)) unique.set(hit.url, hit);
  }
  const candidates = [...unique.values()];

  const picked = await pickBestImageCandidate(candidates, {
    itemTitle: options.itemTitle,
    outline: options.outline,
  });

  if (!picked || !isLikelyImageUrl(picked.url)) return null;

  return {
    url: picked.url,
    title: picked.title,
    caption: picked.title,
  };
}

export async function createDiscoveredImageAsset(
  sessionId: string,
  sortOrder: number,
  discovered: DiscoveredImage,
): Promise<AiSourceAsset> {
  return prisma.aiSourceAsset.create({
    data: {
      sessionId,
      kind: "image",
      filename: discovered.title.slice(0, 120),
      blobUrl: discovered.url,
      mimeType: "image/jpeg",
      placementHint: `Auto-discovered: ${discovered.caption}`,
      includeRecording: false,
      processingStatus: "ready",
      sortOrder,
    },
  });
}
