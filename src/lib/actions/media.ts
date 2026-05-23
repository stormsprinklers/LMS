"use server";

import { put } from "@vercel/blob";
import Mux from "@mux/mux-node";
import { prisma } from "@/lib/db";
import { requireAdmin, requireManageCourseItem } from "@/lib/auth-utils";
import { revalidatePath } from "next/cache";

const mux =
  process.env.MUX_TOKEN_ID && process.env.MUX_TOKEN_SECRET
    ? new Mux({
        tokenId: process.env.MUX_TOKEN_ID,
        tokenSecret: process.env.MUX_TOKEN_SECRET,
      })
    : null;

function muxCorsOrigin() {
  return process.env.NEXTAUTH_URL ?? "http://localhost:3000";
}

async function createMuxDirectUpload(passthrough: string) {
  if (!mux) {
    return { error: "Mux is not configured. Set MUX_TOKEN_ID and MUX_TOKEN_SECRET." };
  }

  const upload = await mux.video.uploads.create({
    cors_origin: muxCorsOrigin(),
    new_asset_settings: {
      playback_policy: ["public"],
      passthrough,
    },
  });

  return { uploadId: upload.id, url: upload.url };
}

export async function createMuxUpload(lessonId: string) {
  await requireAdmin();
  return createMuxDirectUpload(`lesson:${lessonId}`);
}

export async function createMuxUploadForCourseItem(courseItemId: string) {
  await requireManageCourseItem(courseItemId);

  const item = await prisma.courseItem.findUnique({
    where: { id: courseItemId },
    select: { videoLessonId: true, courseId: true, itemType: true },
  });

  if (!item || item.itemType !== "VIDEO" || !item.videoLessonId) {
    return { error: "Not a video lesson item." };
  }

  await prisma.videoLesson.update({
    where: { id: item.videoLessonId },
    data: {
      status: "processing",
      muxAssetId: null,
      muxPlaybackId: null,
    },
  });

  const result = await createMuxDirectUpload(`course-item:${courseItemId}`);

  if (!result.error) {
    revalidatePath(`/admin/courses/${item.courseId}/builder`);
  }

  return result;
}

export async function getVideoLessonUploadStatus(courseItemId: string) {
  await requireManageCourseItem(courseItemId);

  const item = await prisma.courseItem.findUnique({
    where: { id: courseItemId },
    select: {
      videoLesson: {
        select: {
          status: true,
          muxPlaybackId: true,
          muxAssetId: true,
        },
      },
    },
  });

  return {
    status: item?.videoLesson?.status ?? "pending",
    muxPlaybackId: item?.videoLesson?.muxPlaybackId ?? null,
    muxAssetId: item?.videoLesson?.muxAssetId ?? null,
  };
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
