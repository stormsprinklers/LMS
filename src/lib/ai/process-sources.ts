import type { AiSourceAsset } from "@prisma/client";
import { prisma } from "@/lib/db";
import { computeAssetProcessing } from "@/lib/media/process-asset-content";

function toProcessable(asset: AiSourceAsset) {
  return {
    id: asset.id,
    kind: asset.kind,
    filename: asset.filename,
    blobUrl: asset.blobUrl,
    contextNote: asset.placementHint,
    includeRecording: asset.includeRecording,
    extractedText: asset.extractedText,
    transcript: asset.transcript,
  };
}

export async function processSourceAsset(assetId: string): Promise<void> {
  const asset = await prisma.aiSourceAsset.findUnique({ where: { id: assetId } });
  if (!asset) return;

  await prisma.aiSourceAsset.update({
    where: { id: assetId },
    data: { processingStatus: "processing", processingError: null },
  });

  try {
    const updates = await computeAssetProcessing(
      toProcessable(asset),
      `ai-asset:${assetId}`,
    );

    const processingError =
      typeof updates.processingError === "string" ? updates.processingError : null;

    await prisma.aiSourceAsset.update({
      where: { id: assetId },
      data: {
        extractedText: updates.extractedText,
        transcript: updates.transcript,
        summary: updates.summary,
        muxAssetId: updates.muxAssetId,
        muxPlaybackId: updates.muxPlaybackId,
        durationSeconds: updates.durationSeconds,
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
