import type {
  AiAssetProcessingStatus,
  AiSourceAssetKind,
  LibraryAssetScope,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { isStaff } from "@/lib/auth/permissions";
import { processLibraryAsset } from "@/lib/library/process-library-asset";
import { isHttpUrl } from "@/lib/media/asset-utils";
import { isYouTubeUrl } from "@/lib/video/youtube";

const BLOB_HOST_RE = /(^|\.)blob\.vercel-storage\.com$/i;

function libraryScope(role: string | undefined): LibraryAssetScope {
  if (role && !isStaff(role)) return "personal";
  return "shared";
}

function courseDescription(courseTitle: string, itemTitle: string): string {
  return `Uploaded from course "${courseTitle}" · ${itemTitle}`;
}

function isBlobStorageUrl(url: string): boolean {
  try {
    return BLOB_HOST_RE.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

function kindFromUrl(url: string): AiSourceAssetKind {
  if (/\.pdf(\?|$)/i.test(url)) return "pdf";
  if (/\.(pptx|ppt)(\?|$)/i.test(url)) return "pptx";
  if (/\.(mp3|wav|m4a|ogg)(\?|$)/i.test(url)) return "audio";
  if (/\.(mp4|mov|webm)(\?|$)/i.test(url)) return "video";
  return "image";
}

function extractMediaUrlsFromHtml(html: string): string[] {
  const urls = new Set<string>();

  const attrRe = /(?:src|href)=["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = attrRe.exec(html)) !== null) {
    const url = match[1];
    if (!isHttpUrl(url)) continue;
    if (isBlobStorageUrl(url) || kindFromUrl(url) !== "image") {
      urls.add(url);
    }
  }

  return [...urls];
}

async function getCourseItemMeta(courseItemId: string) {
  return prisma.courseItem.findUnique({
    where: { id: courseItemId },
    include: {
      course: { select: { id: true, title: true, createdById: true } },
      videoLesson: true,
      lessonContent: { select: { bodyHtml: true } },
    },
  });
}

type UpsertParams = {
  userId: string;
  role?: string;
  courseId: string;
  courseItemId: string;
  courseTitle: string;
  itemTitle: string;
  kind: AiSourceAssetKind;
  title: string;
  blobUrl?: string | null;
  muxAssetId?: string | null;
  muxPlaybackId?: string | null;
  transcript?: string | null;
  extractedText?: string | null;
  durationSeconds?: number | null;
  filename?: string | null;
  mimeType?: string | null;
  includeRecording?: boolean;
  processingStatus?: AiAssetProcessingStatus;
};

async function upsertLibraryAssetFromCourse(params: UpsertParams): Promise<string | null> {
  const description = courseDescription(params.courseTitle, params.itemTitle);
  const scope = libraryScope(params.role);
  const processingStatus = params.processingStatus ?? "pending";

  const data = {
    title: params.title,
    description,
    scope,
    createdById: params.userId,
    kind: params.kind,
    sourceCourseId: params.courseId,
    sourceCourseItemId: params.courseItemId,
    blobUrl: params.blobUrl ?? null,
    muxAssetId: params.muxAssetId ?? null,
    muxPlaybackId: params.muxPlaybackId ?? null,
    transcript: params.transcript ?? null,
    extractedText: params.extractedText ?? null,
    durationSeconds: params.durationSeconds ?? null,
    filename: params.filename ?? null,
    mimeType: params.mimeType ?? null,
    includeRecording: params.includeRecording ?? true,
    processingStatus,
  };

  if (params.muxPlaybackId) {
    const byMux = await prisma.libraryAsset.findFirst({
      where: { muxPlaybackId: params.muxPlaybackId, archived: false },
    });
    if (byMux) {
      if (!byMux.sourceCourseItemId) {
        await prisma.libraryAsset.update({
          where: { id: byMux.id },
          data: {
            sourceCourseId: params.courseId,
            sourceCourseItemId: params.courseItemId,
            description,
          },
        });
        revalidatePath("/library");
      }
      return byMux.id;
    }
  }

  if (params.blobUrl) {
    const byUrl = await prisma.libraryAsset.findFirst({
      where: { blobUrl: params.blobUrl, archived: false },
    });
    if (byUrl) {
      if (!byUrl.sourceCourseItemId) {
        await prisma.libraryAsset.update({
          where: { id: byUrl.id },
          data: {
            sourceCourseId: params.courseId,
            sourceCourseItemId: params.courseItemId,
            description,
          },
        });
        revalidatePath("/library");
      }
      return byUrl.id;
    }
  }

  if (params.kind === "video") {
    const existing = await prisma.libraryAsset.findFirst({
      where: {
        sourceCourseItemId: params.courseItemId,
        kind: "video",
        archived: false,
      },
    });
    if (existing) {
      const updated = await prisma.libraryAsset.update({
        where: { id: existing.id },
        data,
      });
      if (updated.processingStatus === "pending") {
        void processLibraryAsset(updated.id);
      }
      revalidatePath("/library");
      return updated.id;
    }
  } else if (params.blobUrl) {
    const existing = await prisma.libraryAsset.findFirst({
      where: {
        sourceCourseItemId: params.courseItemId,
        blobUrl: params.blobUrl,
        archived: false,
      },
    });
    if (existing) {
      await prisma.libraryAsset.update({
        where: { id: existing.id },
        data: { title: params.title, description },
      });
      revalidatePath("/library");
      return existing.id;
    }
  }

  const asset = await prisma.libraryAsset.create({ data });
  if (asset.processingStatus === "pending") {
    void processLibraryAsset(asset.id);
  }
  revalidatePath("/library");
  return asset.id;
}

export async function syncCourseVideoToLibrary(params: {
  courseItemId: string;
  userId: string;
  role?: string;
  muxAssetId?: string | null;
  muxPlaybackId?: string | null;
  videoUrl?: string | null;
  transcript?: string | null;
  durationSeconds?: number | null;
}): Promise<void> {
  const item = await getCourseItemMeta(params.courseItemId);
  if (!item || item.itemType !== "VIDEO") return;

  const vl = item.videoLesson;
  const muxPlaybackId = params.muxPlaybackId ?? vl?.muxPlaybackId;
  const muxAssetId = params.muxAssetId ?? vl?.muxAssetId;
  const videoUrl = params.videoUrl ?? vl?.videoUrl;
  const transcript = params.transcript ?? vl?.transcript ?? null;

  if (muxPlaybackId) {
    await upsertLibraryAssetFromCourse({
      userId: params.userId,
      role: params.role,
      courseId: item.course.id,
      courseItemId: item.id,
      courseTitle: item.course.title,
      itemTitle: item.title,
      kind: "video",
      title: item.title,
      filename: "Video recording",
      muxAssetId,
      muxPlaybackId,
      transcript,
      durationSeconds: params.durationSeconds ?? vl?.durationSeconds ?? null,
      includeRecording: true,
      processingStatus: "ready",
    });
    return;
  }

  if (videoUrl && isYouTubeUrl(videoUrl)) {
    await upsertLibraryAssetFromCourse({
      userId: params.userId,
      role: params.role,
      courseId: item.course.id,
      courseItemId: item.id,
      courseTitle: item.course.title,
      itemTitle: item.title,
      kind: "video",
      title: item.title,
      filename: "Video link",
      blobUrl: videoUrl,
      extractedText: videoUrl,
      includeRecording: false,
      processingStatus: "pending",
    });
  }
}

export async function syncCourseLessonMediaToLibrary(params: {
  courseItemId: string;
  userId: string;
  role?: string;
  bodyHtml?: string | null;
}): Promise<void> {
  const item = await getCourseItemMeta(params.courseItemId);
  if (!item || item.itemType !== "LESSON") return;

  const html = params.bodyHtml ?? item.lessonContent?.bodyHtml ?? "";
  const urls = extractMediaUrlsFromHtml(html);

  for (const url of urls) {
    const kind = kindFromUrl(url);
    const filename =
      decodeURIComponent(url.split("/").pop()?.split("?")[0] ?? "") ||
      (kind === "pdf" ? "document.pdf" : "image");

    await upsertLibraryAssetFromCourse({
      userId: params.userId,
      role: params.role,
      courseId: item.course.id,
      courseItemId: item.id,
      courseTitle: item.course.title,
      itemTitle: item.title,
      kind,
      title: `${item.title} · ${filename}`,
      filename,
      blobUrl: url,
      includeRecording: false,
      processingStatus: kind === "image" ? "ready" : "pending",
    });
  }
}

export async function syncCourseItemMediaToLibrary(params: {
  courseItemId: string;
  userId: string;
  role?: string;
  bodyHtml?: string | null;
}): Promise<void> {
  const item = await getCourseItemMeta(params.courseItemId);
  if (!item) return;

  if (item.itemType === "VIDEO") {
    await syncCourseVideoToLibrary(params);
  } else if (item.itemType === "LESSON") {
    await syncCourseLessonMediaToLibrary(params);
  }
}

export async function syncCourseVideoByCourseItemId(
  courseItemId: string,
  muxAssetId: string,
  muxPlaybackId: string,
  durationSeconds: number | null,
): Promise<void> {
  const item = await prisma.courseItem.findUnique({
    where: { id: courseItemId },
    select: {
      course: {
        select: {
          createdById: true,
          createdBy: { select: { role: true } },
        },
      },
    },
  });
  if (!item?.course.createdById) return;

  await syncCourseVideoToLibrary({
    courseItemId,
    userId: item.course.createdById,
    role: item.course.createdBy?.role,
    muxAssetId,
    muxPlaybackId,
    durationSeconds,
  });
}
