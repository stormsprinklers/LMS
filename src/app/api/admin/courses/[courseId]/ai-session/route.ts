import { NextResponse } from "next/server";
import { getActiveAiSessionForCourse } from "@/lib/actions/ai-builder";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ courseId: string }> },
) {
  const { courseId } = await params;
  const result = await getActiveAiSessionForCourse(courseId);

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  if (!result.session) {
    return NextResponse.json({ session: null });
  }

  const session = result.session;

  return NextResponse.json({
    session: {
      id: session.id,
      status: session.status,
      mode: session.mode,
      targetModuleId: session.targetModuleId,
      userPrompt: session.userPrompt,
      error: session.error,
      allowedItemTypes: session.allowedItemTypes,
      discoverYoutubeVideos: session.discoverYoutubeVideos,
      discoverImages: session.discoverImages,
      blueprintJson: session.blueprintJson,
      contentItemCursor: session.contentItemCursor,
      structureApproved: session.structureApproved,
      updatedAt: session.updatedAt,
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
    },
  });
}
