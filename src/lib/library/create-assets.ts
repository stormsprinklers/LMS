import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { isStaff } from "@/lib/auth/permissions";
import type { LibraryAssetScope } from "@prisma/client";
import { kindFromMime, isHttpUrl } from "@/lib/media/asset-utils";
import { processLibraryAsset } from "@/lib/library/process-library-asset";
import { isYouTubeUrl } from "@/lib/video/youtube";
import { MAX_LIBRARY_BATCH_UPLOAD, uniquifyTitles, validateUniqueDescriptions } from "@/lib/library/folders";
import { resolveLibraryTitle } from "@/lib/library/resolve-title";
import { setLibraryAssetTagsImpl, validateTagIds } from "@/lib/library/tags";

export type LibraryCreateInput = {
  title?: string;
  description: string;
  scope: LibraryAssetScope;
  pastedText?: string;
  sourceUrl?: string;
  urlKind?: "webpage" | "video";
  blobUrl?: string;
  uploadedFilename?: string;
  uploadedMimeType?: string;
  fileSizeBytes?: number;
  includeRecording?: boolean;
  /** Additional tags for this item (merged with batch-level tags on create). */
  tagIds?: string[];
};

type CreateContext = {
  userId: string;
  scope: LibraryAssetScope;
  tagIds?: string[];
};

function formatError(e: unknown): string {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2021") {
      return "Library tables are missing. Run npm run db:migrate:deploy with your production DATABASE_URL.";
    }
    if (e.code === "P2022") {
      return "Library database is out of date (missing columns). Run npm run db:migrate:deploy with your production DATABASE_URL.";
    }
  }
  return e instanceof Error ? e.message : "Something went wrong.";
}

async function finalizeCreatedAsset(
  assetId: string,
  ctx: CreateContext,
): Promise<{ id: string }> {
  if (ctx.tagIds?.length) {
    await setLibraryAssetTagsImpl(assetId, ctx.tagIds);
  }
  return { id: assetId };
}

async function createOneLibraryAsset(
  input: LibraryCreateInput,
  ctx: CreateContext,
  resolvedTitle: string,
): Promise<{ id: string } | { error: string }> {
  const title = resolvedTitle;
  const description = input.description.trim();
  if (!description) return { error: "Description is required." };

  const includeRecording = input.includeRecording !== false;
  const pastedText = input.pastedText?.trim() ?? "";
  const sourceUrl = input.sourceUrl?.trim() ?? "";
  const urlKind = input.urlKind ?? "webpage";

  if (pastedText) {
    const asset = await prisma.libraryAsset.create({
      data: {
        title,
        description,
        scope: ctx.scope,
        createdById: ctx.userId,
        kind: "text",
        filename: title.slice(0, 120),
        extractedText: pastedText,
        fileSizeBytes: new TextEncoder().encode(pastedText).length,
        includeRecording: false,
        processingStatus: "ready",
      },
    });
    return finalizeCreatedAsset(asset.id, ctx);
  }

  if (sourceUrl) {
    if (!isHttpUrl(sourceUrl)) return { error: "Enter a valid http(s) URL." };
    if (isYouTubeUrl(sourceUrl) && urlKind !== "video") {
      return {
        error: 'YouTube links belong under Video. Use the Video upload type.',
      };
    }
    const asVideo = urlKind === "video";
    const asset = await prisma.libraryAsset.create({
      data: {
        title,
        description,
        scope: ctx.scope,
        createdById: ctx.userId,
        kind: asVideo ? "video" : "webpage",
        filename: asVideo ? "Video link" : "Web page",
        blobUrl: sourceUrl,
        includeRecording: asVideo ? includeRecording : false,
        extractedText: asVideo && isYouTubeUrl(sourceUrl) ? sourceUrl : null,
        processingStatus: "pending",
      },
    });
    void processLibraryAsset(asset.id);
    return finalizeCreatedAsset(asset.id, ctx);
  }

  const clientBlobUrl = input.blobUrl?.trim() ?? "";
  const uploadedFilename = input.uploadedFilename?.trim() ?? "";
  const uploadedMimeType = input.uploadedMimeType?.trim() ?? "";

  if (clientBlobUrl) {
    if (!isHttpUrl(clientBlobUrl)) return { error: "Invalid uploaded file URL." };
    if (!uploadedFilename) return { error: "Missing uploaded file name." };

    const kind = kindFromMime(uploadedMimeType, uploadedFilename);
    let textContent: string | null = null;
    if (kind === "text") {
      try {
        const res = await fetch(clientBlobUrl);
        textContent = await res.text();
      } catch {
        textContent = null;
      }
    }

    const asset = await prisma.libraryAsset.create({
      data: {
        title,
        description,
        scope: ctx.scope,
        createdById: ctx.userId,
        kind,
        filename: uploadedFilename,
        mimeType: uploadedMimeType || null,
        fileSizeBytes: input.fileSizeBytes ?? null,
        blobUrl: clientBlobUrl,
        includeRecording: kind === "video" ? includeRecording : false,
        processingStatus:
          kind === "image" || (kind === "text" && textContent) ? "ready" : "pending",
        ...(textContent ? { extractedText: textContent } : {}),
      },
    });

    if (asset.processingStatus === "pending") {
      void processLibraryAsset(asset.id);
    }
    return finalizeCreatedAsset(asset.id, ctx);
  }

  return { error: "No file, link, or text provided." };
}

export async function createLibraryAssetsBatchImpl(
  userId: string,
  role: string | undefined,
  items: LibraryCreateInput[],
  scopeRaw: LibraryAssetScope = "shared",
  tagIds: string[] = [],
): Promise<{ created?: number; error?: string; errors?: string[] }> {
  try {
    if (!items.length) return { error: "Nothing to upload." };
    if (items.length > MAX_LIBRARY_BATCH_UPLOAD) {
      return { error: `Maximum ${MAX_LIBRARY_BATCH_UPLOAD} files per upload.` };
    }

    const scope: LibraryAssetScope =
      scopeRaw === "shared" && isStaff(role) ? "shared" : "personal";

    const descriptionError = validateUniqueDescriptions(
      items.map((item) => item.description),
    );
    if (descriptionError) return { error: descriptionError };

    let validTagIds: string[] = [];
    if (tagIds.length) {
      try {
        validTagIds = await validateTagIds(tagIds);
      } catch (e) {
        return { error: e instanceof Error ? e.message : "Invalid tags." };
      }
    }

    const resolvedTitles = await Promise.all(items.map((item) => resolveLibraryTitle(item)));
    const titles = uniquifyTitles(resolvedTitles);

    const errors: string[] = [];
    let created = 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      let assetTagIds = validTagIds;
      if (item.tagIds?.length) {
        try {
          assetTagIds = await validateTagIds([...validTagIds, ...item.tagIds]);
        } catch (e) {
          errors.push(
            `${titles[i]}: ${e instanceof Error ? e.message : "Invalid tags."}`,
          );
          continue;
        }
      }

      const result = await createOneLibraryAsset(
        { ...item, scope },
        { userId, scope, tagIds: assetTagIds },
        titles[i],
      );
      if ("error" in result) {
        errors.push(`${titles[i]}: ${result.error}`);
      } else {
        created++;
      }
    }

    revalidatePath("/library");
    if (created === 0) {
      return { error: errors[0] ?? "Upload failed.", errors };
    }
    return { created, errors: errors.length ? errors : undefined };
  } catch (e) {
    return { error: formatError(e) };
  }
}
