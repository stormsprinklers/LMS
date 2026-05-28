import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

function resolveLessonId(passthrough: string | undefined): string | null {
  if (!passthrough) return null;
  if (passthrough.startsWith("lesson:")) return passthrough.slice("lesson:".length);
  if (passthrough.startsWith("course-item:")) return null;
  return passthrough;
}

function resolveCourseItemId(passthrough: string | undefined): string | null {
  if (!passthrough?.startsWith("course-item:")) return null;
  return passthrough.slice("course-item:".length);
}

function resolveAiSourceAssetId(passthrough: string | undefined): string | null {
  if (!passthrough?.startsWith("ai-asset:")) return null;
  return passthrough.slice("ai-asset:".length);
}

export async function POST(request: Request) {
  const secret = process.env.MUX_WEBHOOK_SECRET;
  if (secret) {
    const sig = request.headers.get("mux-signature");
    if (!sig) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const body = await request.json();
  const type = body.type as string;

  if (type === "video.asset.ready") {
    const data = body.data;
    const passthrough = data.passthrough as string | undefined;
    const playbackId = data.playback_ids?.[0]?.id;
    const assetId = data.id;
    const duration = data.duration ? Math.round(data.duration) : null;

    const aiAssetId = resolveAiSourceAssetId(passthrough);
    if (aiAssetId && playbackId) {
      await prisma.aiSourceAsset.update({
        where: { id: aiAssetId },
        data: {
          muxAssetId: assetId,
          muxPlaybackId: playbackId,
          durationSeconds: duration,
          processingStatus: "ready",
        },
      });
    }

    const courseItemId = resolveCourseItemId(passthrough);
    if (courseItemId && playbackId) {
      const item = await prisma.courseItem.findUnique({
        where: { id: courseItemId },
        select: { videoLessonId: true, courseId: true },
      });

      if (item?.videoLessonId) {
        await prisma.videoLesson.update({
          where: { id: item.videoLessonId },
          data: {
            muxAssetId: assetId,
            muxPlaybackId: playbackId,
            durationSeconds: duration,
            status: "ready",
          },
        });
        await prisma.course.update({
          where: { id: item.courseId },
          data: { hasUnpublishedChanges: true },
        });
        const course = await prisma.course.findUnique({
          where: { id: item.courseId },
          select: { slug: true },
        });
        if (course) {
          const { revalidatePath } = await import("next/cache");
          revalidatePath(`/courses/${course.slug}`);
          revalidatePath(`/admin/courses/${item.courseId}/builder`);
        }
      }
    } else {
      const lessonId = resolveLessonId(passthrough);
      if (lessonId && playbackId) {
        await prisma.videoAsset.upsert({
          where: { lessonId },
          update: {
            muxAssetId: assetId,
            muxPlaybackId: playbackId,
            durationSeconds: duration,
            status: "ready",
          },
          create: {
            lessonId,
            muxAssetId: assetId,
            muxPlaybackId: playbackId,
            durationSeconds: duration,
            status: "ready",
          },
        });

        const linkedItem = await prisma.courseItem.findFirst({
          where: { legacyLessonId: lessonId },
          select: { videoLessonId: true },
        });
        if (linkedItem?.videoLessonId) {
          await prisma.videoLesson.update({
            where: { id: linkedItem.videoLessonId },
            data: {
              muxAssetId: assetId,
              muxPlaybackId: playbackId,
              durationSeconds: duration,
              status: "ready",
            },
          });
        }
      }
    }
  }

  return NextResponse.json({ received: true });
}
