"use server";

import { put } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser, requireStaff } from "@/lib/auth-utils";
import { isStaff } from "@/lib/auth/permissions";
import type { LibraryAssetScope } from "@prisma/client";
import { MAX_MEDIA_FILE_BYTES } from "@/lib/media/asset-utils";
import { processLibraryAsset } from "@/lib/library/process-library-asset";
import { blobStorageError } from "@/lib/media/blob-config";
import {
  createLibraryAssetsBatchImpl,
  type LibraryCreateInput,
} from "@/lib/library/create-assets";
import { listLibraryAssetsImpl } from "@/lib/library/list-assets";

export type { LibraryAssetListItem } from "@/lib/library/types";
export type { LibraryCreateInput } from "@/lib/library/create-assets";

function formatActionError(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong.";
}

export async function listLibraryAssets() {
  try {
    const session = await requireUser();
    return listLibraryAssetsImpl(session.user.id);
  } catch (e) {
    return { error: formatActionError(e) };
  }
}

export async function listLibraryAssetsForPicker() {
  return listLibraryAssets();
}

export async function createLibraryAssetsBatch(
  items: LibraryCreateInput[],
  scopeRaw: LibraryAssetScope = "personal",
) {
  try {
    const session = await requireUser();
    const role = (session.user as { role?: string }).role;
    return createLibraryAssetsBatchImpl(session.user.id, role, items, scopeRaw);
  } catch (e) {
    return { error: formatActionError(e) };
  }
}

export async function uploadLibraryAsset(formData: FormData) {
  try {
    const session = await requireUser();
    const role = (session.user as { role?: string }).role;
    const scopeRaw = String(formData.get("scope") ?? "personal") as LibraryAssetScope;

    const file = formData.get("file");
    if (file instanceof File && file.size > 0 && !formData.get("blobUrl")) {
      const missingBlob = blobStorageError();
      if (missingBlob) return { error: missingBlob };
      if (file.size > MAX_MEDIA_FILE_BYTES) {
        return { error: "File exceeds 80MB limit." };
      }
      const blob = await put(
        `library/${session.user.id}/${Date.now()}-${file.name}`,
        file,
        { access: "public" },
      );
      formData.set("blobUrl", blob.url);
      formData.set("uploadedFilename", file.name);
      formData.set("uploadedMimeType", file.type || "");
      formData.set("fileSizeBytes", String(file.size));
    }

    const result = await createLibraryAssetsBatchImpl(
      session.user.id,
      role,
      [
        {
          title: String(formData.get("title") ?? ""),
          description: String(formData.get("description") ?? ""),
          scope: scopeRaw,
          pastedText: String(formData.get("pastedText") ?? ""),
          sourceUrl: String(formData.get("sourceUrl") ?? ""),
          urlKind: String(formData.get("urlKind") ?? "webpage") as "webpage" | "video",
          blobUrl: String(formData.get("blobUrl") ?? ""),
          uploadedFilename: String(formData.get("uploadedFilename") ?? ""),
          uploadedMimeType: String(formData.get("uploadedMimeType") ?? ""),
          fileSizeBytes: Number(formData.get("fileSizeBytes")) || undefined,
          includeRecording: formData.get("includeRecording") !== "false",
        },
      ],
      scopeRaw,
    );

    if (result.error && !result.created) return { error: result.error };
    return { asset: { id: "ok" } };
  } catch (e) {
    return { error: formatActionError(e) };
  }
}

export async function updateLibraryAsset(
  assetId: string,
  data: { title?: string; description?: string; scope?: LibraryAssetScope },
) {
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
    return { error: formatActionError(e) };
  }
}

export async function archiveLibraryAsset(assetId: string) {
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
    return { error: formatActionError(e) };
  }
}

export async function reprocessLibraryAsset(assetId: string) {
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
    return { error: formatActionError(e) };
  }
}

export async function requireLibraryStaff() {
  return requireStaff();
}
