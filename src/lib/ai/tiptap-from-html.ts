import { expandStormMediaInLessonHtml, type LessonMediaAsset } from "./lesson-html";

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function textNode(text: string) {
  return text ? [{ type: "text", text }] : [];
}

function paragraphFromHtml(inner: string) {
  const text = stripTags(inner);
  return {
    type: "paragraph",
    content: textNode(text),
  };
}

function headingFromHtml(level: 2 | 3, inner: string) {
  const text = stripTags(inner);
  return {
    type: "heading",
    attrs: { level },
    content: textNode(text),
  };
}

/** TipTap JSON doc from lesson HTML (headings, paragraphs, lists). */
export function tiptapDocFromHtml(
  html: string,
  assets: LessonMediaAsset[] = [],
): Record<string, unknown> {
  const expanded = expandStormMediaInLessonHtml(html, assets);
  const blocks: Record<string, unknown>[] = [];

  const re = new RegExp(
    '<(h2|h3|p|ul)(?:\\s[^>]*)?>([\\s\\S]*?)<\\/\\1>',
    "gi",
  );

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(expanded)) !== null) {
    const before = expanded.slice(lastIndex, match.index).trim();
    if (before) {
      const text = stripTags(before);
      if (text) blocks.push(paragraphFromHtml(text));
    }

    const tag = match[1].toLowerCase();
    const inner = match[2] ?? "";

    if (tag === "h2") blocks.push(headingFromHtml(2, inner));
    else if (tag === "h3") blocks.push(headingFromHtml(3, inner));
    else if (tag === "p") blocks.push(paragraphFromHtml(inner));
    else if (tag === "ul") {
      const items = inner.match(/<li[^>]*>([\s\S]*?)<\/li>/gi) ?? [];
      if (items.length > 0) {
        blocks.push({
          type: "bulletList",
          content: items.map((li) => ({
            type: "listItem",
            content: [paragraphFromHtml(li.replace(/<\/?li[^>]*>/gi, ""))],
          })),
        });
      }
    }

    lastIndex = match.index + match[0].length;
  }

  const tail = expanded.slice(lastIndex).trim();
  if (tail) {
    const text = stripTags(tail);
    if (text) blocks.push(paragraphFromHtml(text));
  }

  if (blocks.length === 0) {
    const stripped = stripTags(expanded);
    if (!stripped) {
      return { type: "doc", content: [{ type: "paragraph" }] };
    }
    return {
      type: "doc",
      content: [paragraphFromHtml(stripped)],
    };
  }

  return { type: "doc", content: blocks };
}

export function injectImageIntoHtml(
  html: string,
  imageUrl: string,
  alt: string,
  position: "intro" | "after_section" | "inline" | "item_end",
): string {
  const img = `<figure class="lesson-media lesson-media--image"><img src="${imageUrl}" alt="${alt.replace(/"/g, "&quot;")}" loading="lazy" /><figcaption>${alt.replace(/"/g, "&quot;")}</figcaption></figure>`;
  if (position === "intro") return `${img}\n${html}`;
  if (position === "item_end") return `${html}\n${img}`;
  return `${html}\n${img}`;
}
