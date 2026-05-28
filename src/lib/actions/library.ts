"use server";

import { put } from "@vercel/blob";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser, requireStaff } from "@/lib/auth-utils";
import { isStaff } from "@/lib/auth/permissions";
import type { LibraryAssetScope } from "@prisma/client";
import {
  kindFromMime,
  isHttpUrl,
  MAX_MEDIA_FILE_BYTES,
} from "@/lib/media/asset-utils";
import { processLibraryAsset } from "@/lib/library/process-library-asset";
import { isYouTubeUrl } from "@/lib/video/youtube";

function formatError(e: unknown): string {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2021") {
    return "Library tables are missing. Run npm run db:migrate:deploy with your production DATABASE_URL.";
  }
  return e instanceof Error ? e.message : "Something went wrong.";
}

export type LibraryAssetListItem = {
  id: string;
  title: string;
  description: string;
  scope: LibraryAssetScope;
  kind: string;
  filename: string | null;
  blobUrl: string | null;
  processingStatus: string;
  processingError: string | null;
  createdAt: string;
  createdBy: { id: string; name: string | null; email: string };
  isOwner: boolean;
};

export async function listLibraryAssets(): Promise<{
  assets?: LibraryAssetListItem[];
  error?: string;
}> {
  try {
    const session = await requireUser();
    const userId = session.user.id;

    const rows = await prisma.libraryAsset.findMany({
      where: {
        archived: false,
        OR: [{ scope: "shared" }, { createdById: userId }],
      },
      orderBy: [{ scope: "asc" }, { updatedAt: "desc" }],
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
        blobUrl: a.blobUrl,
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

export async function listLibraryAssetsForPicker(): Promise<{
  assets?: LibraryAssetListItem[];
  error?: string;
}> {
  return listLibraryAssets();
}

export async function uploadLibraryAsset(
  formData: FormData,
): Promise<{ asset?: { id: string }; error?: string }> {
  try {
    const session = await requireUser();
    const userId = session.user.id;
    const role = (session.user as { role?: string }).role;

    const title = String(formData.get("title") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const scopeRaw = String(formData.get("scope") ?? "personal");
    const scope: LibraryAssetScope =
      scopeRaw === "shared" && isStaff(role) ? "shared" : "personal";

    if (!title) return { error: "Title is required." };
    if (!description) return { error: "Description is required." };

    const includeRecording = formData.get("includeRecording") !== "false";
    const pastedText = String(formData.get("pastedText") ?? "").trim();
    const sourceUrl = String(formData.get("sourceUrl") ?? "").trim();
    const urlKind = String(formData.get("urlKind") ?? "webpage");

    if (pastedText) {
      const asset = await prisma.libraryAsset.create({
        data: {
          title,
          description,
          scope,
          createdById: userId,
          kind: "text",
          filename: title.slice(0, 120),
          extractedText: pastedText,
          includeRecording: false,
          processingStatus: "ready",
        },
      });
      revalidatePath("/library");
      return { asset: { id: asset.id } };
    }

    if (sourceUrl) {
      if (!isHttpUrl(sourceUrl)) return { error: "Enter a valid http(s) URL." };
      const asVideo = urlKind === "video" || isYouTubeUrl(sourceUrl);
      const asset = await prisma.libraryAsset.create({
        data: {
          title,
          description,
          scope,
          createdById: userId,
          kind: asVideo ? "video" : "webpage",
          filename: asVideo ? "Video link" : "Web page",
          blobUrl: sourceUrl,
          includeRecording: asVideo ? includeRecording : false,
          extractedText: asVideo && isYouTubeUrl(sourceUrl) ? sourceUrl : null,
          processingStatus: "pending",
        },
      });
      void processLibraryAsset(asset.id);
      revalidatePath("/library");
      return { asset: { id: asset.id } };
    }

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { error: "Choose a file, paste text, or enter a URL." };
    }
    if (file.size > MAX_MEDIA_FILE_BYTES) {
      return { error: "File exceeds 80MB limit." };
    }

    const kind = kindFromMime(file.type, file.name);
    const textContent =
      kind === "text" ? await file.text().catch(() => null) : null;

    const blob = await put(`library/${userId}/${Date.now()}-${file.name}`, file, {
      access: "public",
    });

    const asset = await prisma.libraryAsset.create({
      data: {
        title,
        description,
        scope,
        createdById: userId,
        kind,
        filename: file.name,
        mimeType: file.type || null,
        blobUrl: blob.url,
        includeRecording: kind === "video" ? includeRecording : false,
        processingStatus:
          kind === "image" || (kind === "text" && textContent) ? "ready" : "pending",
        ...(textContent ? { extractedText: textContent } : {}),
      },
    });

    if (asset.processingStatus === "pending") {
      void processLibraryAsset(asset.id);
    }

    revalidatePath("/library");
    return { asset: { id: asset.id } };
  } catch (e) {
    return { error: formatError(e) };
  }
}

export async function updateLibraryAsset(
  assetId: string,
  data: { title?: string; description?: string; scope?: LibraryAssetScope },
): Promise<{ error?: string }> {
  try {
    const session = await requireUser();
    const userId = session.user.id;
    const role = (session.user as { role?: string }).role;

    const asset = await prisma.libraryAsset.findUnique({ where: { id: assetId } });
    if (!asset || asset.archived) return { error: "Asset not found." };

    const isOwner = asset.createdById === userId;
    if (!isOwner && !isStaff(role)) return { error: "Not allowed." };
    if (data.scope === "shared" && !isStaff(role)) {
      return { error: "Only admins and managers can publish to the shared library." };
    }

    await prisma.libraryAsset.update({
      where: { id: assetId },
      data: {
        ...(data.title !== undefined ? { title: data.title.trim() } : {}),
        ...(data.description !== undefined
          ? { description: data.description.trim() }
          : {}),
        ...(data.scope !== undefined ? { scope: data.scope } : {}),
      },
    });
    revalidatePath("/library");
    return {};
  } catch (e) {
    return { error: formatError(e) };
  }
}

export async function archiveLibraryAsset(
  assetId: string,
): Promise<{ error?: string }> {
  try {
    const session = await requireUser();
    const userId = session.user.id;
    const role = (session.user as { role?: string }).role;

    const asset = await prisma.libraryAsset.findUnique({ where: { id: assetId } });
    if (!asset) return { error: "Asset not found." };

    const isOwner = asset.createdById === userId;
    if (!isOwner && !isStaff(role)) return { error: "Not allowed." };

    await prisma.libraryAsset.update({
      where: { id: assetId },
      data: { archived: true, archivedAt: new Date() },
    });
    revalidatePath("/library");
    return {};
  } catch (e) {
    return { error: formatError(e) };
  }
}

export async function reprocessLibraryAsset(
  assetId: string,
): Promise<{ error?: string }> {
  try {
    const session = await requireUser();
    const asset = await prisma.libraryAsset.findUnique({ where: { id: assetId } });
    if (!asset || asset.archived) return { error: "Asset not found." };

    const userId = session.user.id;
    const role = (session.user as { role?: string }).role;
    if (asset.createdById !== userId && !isStaff(role)) {
      return { error: "Not allowed." };
    }

    await prisma.libraryAsset.update({
      where: { id: assetId },
      data: { processingStatus: "pending", processingError: null },
    });
    await processLibraryAsset(assetId);
    revalidatePath("/library");
    return {};
  } catch (e) {
    return { error: formatError(e) };
  }
}

/** Staff-only: list all shared assets for admin overview */
export async function requireLibraryStaff() {
  return requireStaff();
}
