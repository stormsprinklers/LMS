import { requireOpenAI } from "@/lib/ai/openai-client";

export function buildBadgePrompt(certificationName: string): string {
  const name = certificationName.trim() || "Certification";
  return `Create one clean certification badge as a 500 × 500 square image. Center a circular blue rosette with generous white margin so it cannot be clipped when cropped. Use a thick white ring, a thinner black ring, and a white center. Place one bold, simplified black-and-blue icon in the center.

Choose a recognizable niche tool or instrument directly associated with “${name}” as the icon. Prefer specialized trade tools over generic symbols, unless the tool would be unclear, overly detailed, or unsuitable inside a small badge; in that case, use the simplest recognizable symbol for the subject.

Use only blue #0058E0, black #111111, and white #FFFFFF. Keep the design symmetrical, high-contrast, vector-like, and readable as a very small app icon. Use thick shapes, minimal details, and only a subtle soft shadow. No text, letters, numbers, ribbons, banners, extra badges, decorative objects, mockups, or color-palette displays. Show exactly one badge.`;
}

export async function generateCertificationBadgeImage(
  certificationName: string
): Promise<{ buffer: Buffer; mimeType: string }> {
  const openai = requireOpenAI();
  const prompt = buildBadgePrompt(certificationName);

  const result = await openai.images.generate({
    model: process.env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-1",
    prompt,
    size: "1024x1024",
    n: 1,
  });

  const image = result.data?.[0];
  if (!image) {
    throw new Error("OpenAI did not return a badge image.");
  }

  if (image.b64_json) {
    return {
      buffer: Buffer.from(image.b64_json, "base64"),
      mimeType: "image/png",
    };
  }

  if (image.url) {
    const res = await fetch(image.url);
    if (!res.ok) throw new Error("Failed to download generated badge image.");
    const arrayBuffer = await res.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      mimeType: res.headers.get("content-type") || "image/png",
    };
  }

  throw new Error("OpenAI badge response had no image data.");
}
