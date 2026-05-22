"use server";

import { put } from "@vercel/blob";
import Mux from "@mux/mux-node";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-utils";
import { revalidatePath } from "next/cache";

const mux = process.env.MUX_TOKEN_ID && process.env.MUX_TOKEN_SECRET
  ? new Mux({
      tokenId: process.env.MUX_TOKEN_ID,
      tokenSecret: process.env.MUX_TOKEN_SECRET,
    })
  : null;

export async function createMuxUpload(lessonId: string) {
  await requireAdmin();
  if (!mux) return { error: "Mux is not configured." };

  const upload = await mux.video.uploads.create({
    cors_origin: process.env.NEXTAUTH_URL ?? "http://localhost:3000",
    new_asset_settings: {
      playback_policy: ["public"],
      passthrough: lessonId,
    },
  });

  return { uploadId: upload.id, url: upload.url };
}

export async function uploadManualPdf(formData: FormData) {
  await requireAdmin();
  const file = formData.get("file") as File | null;
  const manualId = formData.get("manualId") as string | null;
  if (!file || !manualId) return { error: "Missing file or manual ID." };

  if (!file.type.includes("pdf")) {
    return { error: "Only PDF files are allowed." };
  }

  const blob = await put(`manuals/${manualId}-${file.name}`, file, {
    access: "public",
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });

  await prisma.manualAsset.update({
    where: { id: manualId },
    data: { blobUrl: blob.url, filename: file.name },
  });

  revalidatePath("/manuals");
  revalidatePath("/admin/media");
  return { url: blob.url };
}

export async function linkMuxAsset(
  lessonId: string,
  muxAssetId: string,
  muxPlaybackId: string,
  durationSeconds?: number,
) {
  await requireAdmin();
  await prisma.videoAsset.upsert({
    where: { lessonId },
    update: {
      muxAssetId,
      muxPlaybackId,
      durationSeconds,
      status: "ready",
    },
    create: {
      lessonId,
      muxAssetId,
      muxPlaybackId,
      durationSeconds,
      status: "ready",
    },
  });
  revalidatePath("/training");
}
