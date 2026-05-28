import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { LibraryAssetListItem } from "@/lib/library/types";

function formatError(e: unknown): string {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2021") {
    return "Library tables are missing. Run npm run db:migrate:deploy with your production DATABASE_URL.";
  }
  return e instanceof Error ? e.message : "Something went wrong.";
}

export async function listLibraryAssetsImpl(userId: string): Promise<{
  assets?: LibraryAssetListItem[];
  error?: string;
}> {
  try {
    const rows = await prisma.libraryAsset.findMany({
      where: {
        archived: false,
        OR: [{ scope: "shared" }, { createdById: userId }],
      },
      orderBy: [{ updatedAt: "desc" }],
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    return {
      assets: rows.map((a) => ({
        id: a.id,
        title: a.title,
        description: a.description,
        scope: a.scope,
        kind: a.kind,
        filename: a.filename,
        mimeType: a.mimeType,
        fileSizeBytes: a.fileSizeBytes,
        blobUrl: a.blobUrl,
        muxPlaybackId: a.muxPlaybackId,
        processingStatus: a.processingStatus,
        processingError: a.processingError,
        createdAt: a.createdAt.toISOString(),
        createdBy: a.createdBy,
        isOwner: a.createdById === userId,
      })),
    };
  } catch (e) {
    return { error: formatError(e) };
  }
}
