import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

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
    const lessonId = data.passthrough as string | undefined;
    const playbackId = data.playback_ids?.[0]?.id;
    const assetId = data.id;
    const duration = data.duration;

    if (lessonId && playbackId) {
      await prisma.videoAsset.upsert({
        where: { lessonId },
        update: {
          muxAssetId: assetId,
          muxPlaybackId: playbackId,
          durationSeconds: duration ? Math.round(duration) : null,
          status: "ready",
        },
        create: {
          lessonId,
          muxAssetId: assetId,
          muxPlaybackId: playbackId,
          durationSeconds: duration ? Math.round(duration) : null,
          status: "ready",
        },
      });
    }
  }

  return NextResponse.json({ received: true });
}
