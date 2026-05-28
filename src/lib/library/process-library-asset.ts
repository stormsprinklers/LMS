import { prisma } from "@/lib/db";
import { computeAssetProcessing } from "@/lib/media/process-asset-content";

export async function processLibraryAsset(assetId: string): Promise<void> {
  const asset = await prisma.libraryAsset.findUnique({ where: { id: assetId } });
  if (!asset) return;

  await prisma.libraryAsset.update({
    where: { id: assetId },
    data: { processingStatus: "processing", processingError: null },
  });

  try {
    const updates = await computeAssetProcessing(
      {
        id: asset.id,
        kind: asset.kind,
        filename: asset.filename,
        blobUrl: asset.blobUrl,
        contextNote: asset.description,
        includeRecording: asset.includeRecording,
        extractedText: asset.extractedText,
        transcript: asset.transcript,
      },
      `library-asset:${assetId}`,
    );

    const processingError =
      typeof updates.processingError === "string" ? updates.processingError : null;

    await prisma.libraryAsset.update({
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
    await prisma.libraryAsset.update({
      where: { id: assetId },
      data: {
        processingStatus: "failed",
        processingError: e instanceof Error ? e.message : "Processing failed.",
      },
    });
  }
}

export async function processLibraryAssetIfNeeded(assetId: string): Promise<void> {
  const asset = await prisma.libraryAsset.findUnique({ where: { id: assetId } });
  if (!asset || asset.processingStatus === "ready") return;
  await processLibraryAsset(assetId);
}
