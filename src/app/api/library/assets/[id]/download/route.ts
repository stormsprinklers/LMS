import { auth } from "@/auth";
import {
  fetchLibraryAssetBlob,
  getLibraryAssetForDownload,
  libraryDownloadFilename,
} from "@/lib/library/download-asset";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const asset = await getLibraryAssetForDownload(session.user.id, id);
  if (!asset) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  try {
    const upstream = await fetchLibraryAssetBlob(asset.blobUrl!);
    const filename = libraryDownloadFilename(asset);
    const contentType =
      asset.mimeType ||
      upstream.headers.get("content-type") ||
      "application/octet-stream";

    return new Response(upstream.body, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Download failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
