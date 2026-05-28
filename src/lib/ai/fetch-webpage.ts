/** Best-effort plain text from an HTML page (articles, docs, etc.). */
export async function fetchWebpageText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "StormLMS/1.0 (course-builder)",
      Accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(25_000),
  });

  if (!res.ok) {
    throw new Error(`Could not fetch page (${res.status}).`);
  }

  const html = await res.text();
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");

  const titleMatch = withoutScripts.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch?.[1]?.replace(/<[^>]+>/g, "").trim() ?? "";

  const bodyMatch = withoutScripts.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const bodyHtml = bodyMatch?.[1] ?? withoutScripts;
  const body = bodyHtml
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const combined = [title, body].filter(Boolean).join("\n\n");
  return combined.slice(0, 80_000);
}
