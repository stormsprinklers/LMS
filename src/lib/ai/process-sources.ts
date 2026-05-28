import type { AiSourceAsset } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AI_SUMMARY_MODEL, getOpenAIClient, requireOpenAI } from "./openai-client";
import Mux from "@mux/mux-node";

const mux =
  process.env.MUX_TOKEN_ID && process.env.MUX_TOKEN_SECRET
    ? new Mux({
        tokenId: process.env.MUX_TOKEN_ID,
        tokenSecret: process.env.MUX_TOKEN_SECRET,
      })
    : null;

async function summarizeText(text: string, label: string): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) return "";
  if (trimmed.length < 500) return trimmed;

  const openai = getOpenAIClient();
  if (!openai) {
    return trimmed.slice(0, 2000);
  }

  const res = await openai.chat.completions.create({
    model: AI_SUMMARY_MODEL,
    messages: [
      {
        role: "system",
        content:
          "Summarize training source material in 8-12 bullet points for course authoring. Keep facts, procedures, and safety notes.",
      },
      {
        role: "user",
        content: `${label}\n\n${trimmed.slice(0, 24_000)}`,
      },
    ],
    max_tokens: 800,
  });

  return res.choices[0]?.message?.content?.trim() || trimmed.slice(0, 2000);
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text ?? "";
  } finally {
    await parser.destroy();
  }
}

async function extractPptxText(buffer: Buffer): Promise<string> {
  const { parseOffice } = await import("officeparser");
  const ast = await parseOffice(buffer);
  return typeof ast.toText === "function" ? ast.toText() : String(ast);
}

async function transcribeAudio(buffer: Buffer, filename: string): Promise<string> {
  const openai = requireOpenAI();
  const bytes = new Uint8Array(buffer);
  const file = new File([bytes], filename || "audio.mp3", { type: "audio/mpeg" });
  const result = await openai.audio.transcriptions.create({
    file,
    model: "whisper-1",
  });
  return result.text;
}

async function waitForMuxAsset(assetId: string, maxMs = 90_000): Promise<{
  playbackId?: string;
  durationSeconds?: number;
}> {
  if (!mux) return {};
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const asset = await mux.video.assets.retrieve(assetId);
    if (asset.status === "ready") {
      const playbackId = asset.playback_ids?.find((p) => p.policy === "public")?.id;
      return {
        playbackId: playbackId ?? asset.playback_ids?.[0]?.id,
        durationSeconds: asset.duration ? Math.round(asset.duration) : undefined,
      };
    }
    if (asset.status === "errored") break;
    await new Promise((r) => setTimeout(r, 3000));
  }
  return {};
}

async function processVideoAsset(asset: AiSourceAsset): Promise<Partial<AiSourceAsset>> {
  const updates: Partial<AiSourceAsset> = {};
  const blobUrl = asset.blobUrl;
  if (!blobUrl) {
    return { processingError: "Missing file URL." };
  }

  let transcript = asset.transcript ?? "";
  if (!transcript) {
    try {
      const res = await fetch(blobUrl);
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        transcript = await transcribeAudio(buf, asset.filename ?? "video.mp4");
        updates.transcript = transcript;
      }
    } catch (e) {
      updates.processingError =
        e instanceof Error ? e.message : "Could not transcribe video audio.";
    }
  }

  if (asset.includeRecording && mux) {
    try {
      const created = await mux.video.assets.create({
        inputs: [{ url: blobUrl }],
        playback_policy: ["public"],
        passthrough: `ai-asset:${asset.id}`,
      });
      updates.muxAssetId = created.id;
      const ready = await waitForMuxAsset(created.id);
      if (ready.playbackId) updates.muxPlaybackId = ready.playbackId;
      if (ready.durationSeconds) updates.durationSeconds = ready.durationSeconds;
    } catch (e) {
      updates.processingError =
        (updates.processingError ? `${updates.processingError}; ` : "") +
        (e instanceof Error ? e.message : "Mux upload failed.");
    }
  }

  const summarySource = transcript || asset.extractedText || "";
  if (summarySource) {
    updates.summary = await summarizeText(summarySource, asset.filename ?? "video");
  }

  return updates;
}

export async function processSourceAsset(assetId: string): Promise<void> {
  const asset = await prisma.aiSourceAsset.findUnique({ where: { id: assetId } });
  if (!asset) return;

  await prisma.aiSourceAsset.update({
    where: { id: assetId },
    data: { processingStatus: "processing", processingError: null },
  });

  try {
    let extractedText = asset.extractedText;
    let transcript = asset.transcript;
    const updates: Record<string, unknown> = {};

    if (asset.kind === "text" && asset.blobUrl) {
      const res = await fetch(asset.blobUrl);
      extractedText = await res.text();
      updates.extractedText = extractedText;
    } else if (asset.kind === "embed") {
      extractedText = asset.placementHint ?? asset.blobUrl ?? "";
      updates.extractedText = extractedText;
    } else if ((asset.kind === "pdf" || asset.kind === "pptx") && asset.blobUrl) {
      const res = await fetch(asset.blobUrl);
      const buf = Buffer.from(await res.arrayBuffer());
      extractedText =
        asset.kind === "pdf" ? await extractPdfText(buf) : await extractPptxText(buf);
      updates.extractedText = extractedText;
    } else if (asset.kind === "audio" && asset.blobUrl) {
      const res = await fetch(asset.blobUrl);
      const buf = Buffer.from(await res.arrayBuffer());
      transcript = await transcribeAudio(buf, asset.filename ?? "audio.mp3");
      updates.transcript = transcript;
    } else if (asset.kind === "video") {
      const videoUpdates = await processVideoAsset(asset);
      Object.assign(updates, videoUpdates);
      transcript = (videoUpdates.transcript as string) ?? transcript;
      extractedText = transcript;
    } else if (asset.kind === "image") {
      extractedText = asset.placementHint ?? asset.filename ?? "Image asset";
      updates.extractedText = extractedText;
    }

    const summarySource =
      (updates.summary as string) ||
      (updates.transcript as string) ||
      transcript ||
      extractedText ||
      "";
    if (summarySource && !updates.summary) {
      updates.summary = await summarizeText(
        summarySource,
        asset.filename ?? asset.kind,
      );
    }

    const processingError =
      typeof updates.processingError === "string" ? updates.processingError : null;

    await prisma.aiSourceAsset.update({
      where: { id: assetId },
      data: {
        extractedText: updates.extractedText as string | undefined,
        transcript: updates.transcript as string | undefined,
        summary: updates.summary as string | undefined,
        muxAssetId: updates.muxAssetId as string | undefined,
        muxPlaybackId: updates.muxPlaybackId as string | undefined,
        durationSeconds: updates.durationSeconds as number | undefined,
        processingError,
        processingStatus: processingError ? "failed" : "ready",
      },
    });
  } catch (e) {
    await prisma.aiSourceAsset.update({
      where: { id: assetId },
      data: {
        processingStatus: "failed",
        processingError: e instanceof Error ? e.message : "Processing failed.",
      },
    });
  }
}

export async function processAllSessionAssets(sessionId: string): Promise<void> {
  const assets = await prisma.aiSourceAsset.findMany({
    where: { sessionId, processingStatus: { in: ["pending", "failed"] } },
    orderBy: { sortOrder: "asc" },
  });
  for (const a of assets) {
    await processSourceAsset(a.id);
  }
}
