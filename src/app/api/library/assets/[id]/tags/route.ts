import { auth } from "@/auth";
import { isStaff } from "@/lib/auth/permissions";
import { setLibraryAssetTagsImpl } from "@/lib/library/tags";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: assetId } = await params;
  let body: { tagIds?: string[] };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const asset = await prisma.libraryAsset.findUnique({ where: { id: assetId } });
  if (!asset || asset.archived) {
    return NextResponse.json({ error: "Asset not found." }, { status: 404 });
  }

  const role = (session.user as { role?: string }).role;
  const isOwner = asset.createdById === session.user.id;
  if (!isOwner && !isStaff(role)) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  const result = await setLibraryAssetTagsImpl(assetId, body.tagIds ?? []);
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
