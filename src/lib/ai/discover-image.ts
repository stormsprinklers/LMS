import { prisma } from "@/lib/db";
import type { AiSourceAsset } from "@prisma/client";
import { AI_GENERATION_MODEL, requireOpenAI } from "./openai-client";
import { getGoogleCloudApiKey, getGoogleCseId } from "./google-cloud-api";
import { isHttpUrl } from "@/lib/media/asset-utils";

export type DiscoveredImage = {
  url: string;
  title: string;
  caption: string;
};

type ImageSearchHit = {
  url: string;
  title: string;
};

function isEmbeddableImageUrl(url: string): boolean {
  return isHttpUrl(url);
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

/** Returns the top Google Custom Search image result for a query. */
async function searchGoogleImages(query: string): Promise<ImageSearchHit | null> {
  const key = getGoogleCloudApiKey();
  const cx = getGoogleCseId();
  if (!key || !cx || !query.trim()) return null;

  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("q", query.trim());
  url.searchParams.set("searchType", "image");
  url.searchParams.set("num", "1");
  url.searchParams.set("safe", "active");
  url.searchParams.set("key", key);
  url.searchParams.set("cx", cx);

  try {
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      items?: {
        title?: string;
        link?: string;
        image?: { contextLink?: string };
      }[];
    };
    const item = data.items?.[0];
    if (!item) return null;
    const imageUrl = item.link?.trim();
    if (!imageUrl || !isEmbeddableImageUrl(imageUrl)) return null;

    return {
      url: imageUrl,
      title: item.title?.trim() || "Training photo",
    };
  } catch {
    return null;
  }
}

/** Find a relevant image URL for a LESSON blueprint item. */
export async function discoverImageForItem(options: {
  courseTitle: string;
  moduleTitle: string;
  itemTitle: string;
  outline?: string;
  userPrompt?: string;
}): Promise<DiscoveredImage | null> {
  if (!getGoogleCloudApiKey() || !getGoogleCseId()) return null;

  const query = await buildImageSearchQuery(options);
  const top = await searchGoogleImages(query);
  if (!top) return null;

  return {
    url: top.url,
    title: top.title,
    caption: top.title,
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
