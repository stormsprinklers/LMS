import { isYouTubeUrl, parseYouTubeVideoId, youtubeNoCookieEmbedUrl } from "@/lib/video/youtube";

/** Injected into AI prompts — lessons must use this HTML shape. */
export const LESSON_HTML_AUTHORING_GUIDE = `
LESSON HTML FORMAT (required for every LESSON item):
- Structure content with section titles and paragraphs only (no bare text outside tags).
- Use <h2>Section title</h2> for each major section (one idea per section).
- Use <p>Paragraph text.</p> for every paragraph. Add a blank line between sections in your mind; each paragraph is its own <p> tag.
- Use <ul><li>...</li></ul> for bullet lists when helpful.
- Place photos and videos INLINE where they support the material using self-closing markers:
  <storm-media asset-id="EXACT_ASSET_ID" caption="Short caption" />
  Use only asset ids from the valid source list. Put the marker on its own line between paragraphs when possible.
- Do not use <h1>, <script>, or inline styles. Do not use markdown (# headings); use HTML only.
`.trim();

export type LessonMediaAsset = {
  id: string;
  kind: string;
  filename?: string | null;
  blobUrl?: string | null;
  muxPlaybackId?: string | null;
  extractedText?: string | null;
  placementHint?: string | null;
};

const STORM_MEDIA_RE = /<storm-media\s+([^>]*?)\s*\/?>/gi;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(text: string): string {
  return escapeHtml(text).replace(/'/g, "&#39;");
}

function parseStormMediaAttrs(attrs: string): { assetId?: string; caption?: string } {
  const assetId =
    /asset-id\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1]?.trim() ||
    /asset-id\s*=\s*([^\s"'>]+)/i.exec(attrs)?.[1]?.trim();
  const caption = /caption\s*=\s*["']([^"']*)["']/i.exec(attrs)?.[1];
  return { assetId, caption };
}

export function renderMediaEmbedHtml(
  asset: LessonMediaAsset,
  caption?: string,
): string {
  const cap = caption?.trim() || asset.placementHint?.trim() || asset.filename || "Media";
  const safeCap = escapeHtml(cap);

  if (asset.kind === "image" && asset.blobUrl) {
    return `<figure class="lesson-media lesson-media--image"><img src="${escapeAttr(asset.blobUrl)}" alt="${safeCap}" loading="lazy" /><figcaption>${safeCap}</figcaption></figure>`;
  }

  if (asset.muxPlaybackId) {
    const src = `https://player.mux.com/${encodeURIComponent(asset.muxPlaybackId)}?autoplay=false`;
    return `<figure class="lesson-media lesson-media--video"><div class="lesson-media__frame"><iframe src="${escapeAttr(src)}" title="${safeCap}" allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;" allowfullscreen></iframe></div><figcaption>${safeCap}</figcaption></figure>`;
  }

  const mediaUrl = asset.blobUrl?.trim() || "";
  if (mediaUrl && isYouTubeUrl(mediaUrl)) {
    const id = parseYouTubeVideoId(mediaUrl);
    if (id) {
      const embed = youtubeNoCookieEmbedUrl(id);
      return `<figure class="lesson-media lesson-media--video"><div class="lesson-media__frame lesson-media__frame--youtube"><iframe src="${escapeAttr(embed)}" title="${safeCap}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div><figcaption>${safeCap}</figcaption></figure>`;
    }
  }

  if (asset.kind === "video" && mediaUrl) {
    return `<figure class="lesson-media lesson-media--video"><div class="lesson-media__frame"><video class="lesson-media__video" src="${escapeAttr(mediaUrl)}" controls playsinline preload="metadata"></video></div><figcaption>${safeCap}</figcaption></figure>`;
  }

  if (asset.kind === "audio" && mediaUrl) {
    return `<figure class="lesson-media lesson-media--audio"><audio class="lesson-media__audio" src="${escapeAttr(mediaUrl)}" controls preload="metadata"></audio><figcaption>${safeCap}</figcaption></figure>`;
  }

  if (mediaUrl && (asset.kind === "embed" || asset.kind === "webpage")) {
    return `<figure class="lesson-media lesson-media--embed"><p class="lesson-media__link"><a href="${escapeAttr(mediaUrl)}" target="_blank" rel="noopener noreferrer">${safeCap}</a></p></figure>`;
  }

  return `<figure class="lesson-media lesson-media--missing"><p class="lesson-media__missing">${safeCap} (asset ${escapeHtml(asset.id)} could not be embedded)</p></figure>`;
}

/** Replace <storm-media /> markers with figure/img/video HTML. */
export function expandStormMediaInLessonHtml(
  html: string,
  assets: LessonMediaAsset[],
): string {
  return html.replace(STORM_MEDIA_RE, (_match, attrs: string) => {
    const { assetId, caption } = parseStormMediaAttrs(attrs);
    if (!assetId) return "";
    const asset = assets.find((a) => a.id === assetId);
    if (!asset) {
      return `<figure class="lesson-media lesson-media--missing"><p class="lesson-media__missing">Unknown media id: ${escapeHtml(assetId)}</p></figure>`;
    }
    return renderMediaEmbedHtml(asset, caption);
  });
}

/** Ensure block-level HTML; strip scripts. */
export function normalizeLessonBodyHtml(html: string): string {
  let out = html.trim();
  if (!out) return "<p></p>";

  out = out.replace(/<script[\s\S]*?<\/script>/gi, "");

  const hasBlockTags = /<(h2|h3|p|ul|ol|li|figure|storm-media)\b/i.test(out);
  if (!hasBlockTags) {
    out = out
      .split(/\n\s*\n/)
      .map((block) => block.trim())
      .filter(Boolean)
      .map((block) => {
        if (/^##\s+/.test(block)) {
          return `<h2>${escapeHtml(block.replace(/^##\s+/, ""))}</h2>`;
        }
        if (/^#\s+/.test(block)) {
          return `<h2>${escapeHtml(block.replace(/^#\s+/, ""))}</h2>`;
        }
        return `<p>${escapeHtml(block)}</p>`;
      })
      .join("\n");
  }

  return out;
}

/** Normalize + expand media — use when saving to DB or showing learners. */
export function prepareLessonHtmlForDisplay(
  html: string,
  assets: LessonMediaAsset[] = [],
): string {
  return expandStormMediaInLessonHtml(normalizeLessonBodyHtml(html), assets);
}

export function lessonHtmlUsesStormMedia(html: string): boolean {
  return /<storm-media\b/i.test(html);
}
