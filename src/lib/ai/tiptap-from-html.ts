/** Minimal TipTap JSON doc from HTML string (paragraphs). */
export function tiptapDocFromHtml(html: string): Record<string, unknown> {
  const stripped = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (!stripped) {
    return { type: "doc", content: [{ type: "paragraph" }] };
  }
  const paragraphs = html
    .split(/<\/p>|<br\s*\/?>/gi)
    .map((p) => p.replace(/<[^>]+>/g, "").trim())
    .filter(Boolean);

  if (paragraphs.length === 0) {
    return {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: stripped }] }],
    };
  }

  return {
    type: "doc",
    content: paragraphs.map((text) => ({
      type: "paragraph",
      content: text ? [{ type: "text", text }] : [],
    })),
  };
}

export function injectImageIntoHtml(
  html: string,
  imageUrl: string,
  alt: string,
  position: "intro" | "after_section" | "inline" | "item_end",
): string {
  const img = `<p><img src="${imageUrl}" alt="${alt.replace(/"/g, "&quot;")}" /></p>`;
  if (position === "intro") return img + html;
  if (position === "item_end") return html + img;
  return html + img;
}
