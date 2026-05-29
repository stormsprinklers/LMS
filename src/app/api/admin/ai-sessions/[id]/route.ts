import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireManageCourse } from "@/lib/auth-utils";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await prisma.aiGenerationSession.findUnique({
    where: { id },
    include: {
      assets: { orderBy: { sortOrder: "asc" } },
      course: { select: { id: true, title: true } },
    },
  });

  if (!session) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await requireManageCourse(session.courseId);

  return NextResponse.json({
    id: session.id,
    status: session.status,
    mode: session.mode,
    error: session.error,
    allowedItemTypes: session.allowedItemTypes,
    discoverYoutubeVideos: session.discoverYoutubeVideos,
    discoverImages: session.discoverImages,
    blueprintJson: session.blueprintJson,
    assets: session.assets.map((a) => ({
      id: a.id,
      kind: a.kind,
      filename: a.filename,
      blobUrl: a.blobUrl,
      placementHint: a.placementHint,
      processingStatus: a.processingStatus,
      processingError: a.processingError,
      includeRecording: a.includeRecording,
    })),
  });
}
