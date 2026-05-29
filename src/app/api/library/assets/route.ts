import { auth } from "@/auth";
import {
  createLibraryAssetsBatchImpl,
  type LibraryCreateInput,
} from "@/lib/library/create-assets";
import { listLibraryAssetsImpl } from "@/lib/library/list-assets";
import type { LibraryAssetScope } from "@prisma/client";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await listLibraryAssetsImpl(session.user.id);
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { items?: LibraryCreateInput[]; scope?: LibraryAssetScope; tagIds?: string[] };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const items = body.items ?? [];
  const scope = body.scope ?? "shared";
  const tagIds = body.tagIds ?? [];
  const role = (session.user as { role?: string }).role;

  const result = await createLibraryAssetsBatchImpl(
    session.user.id,
    role,
    items,
    scope,
    tagIds,
  );

  if (result.error && !result.created) {
    return NextResponse.json(result, { status: 400 });
  }

  return NextResponse.json(result);
}
