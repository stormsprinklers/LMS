import { auth } from "@/auth";
import { isAdmin } from "@/lib/auth/permissions";
import {
  createLibraryTagImpl,
  deleteLibraryTagImpl,
  listLibraryTagsImpl,
  updateLibraryTagImpl,
} from "@/lib/library/tags";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await listLibraryTagsImpl();
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  if (!session?.user?.id || !isAdmin(role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { name?: string; color?: string | null };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const result = await createLibraryTagImpl(body.name ?? "", body.color);
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result);
}

export async function PATCH(request: Request) {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  if (!session?.user?.id || !isAdmin(role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { id?: string; name?: string; color?: string | null };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.id) {
    return NextResponse.json({ error: "Tag id is required." }, { status: 400 });
  }

  const result = await updateLibraryTagImpl(body.id, {
    name: body.name,
    color: body.color,
  });
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  if (!session?.user?.id || !isAdmin(role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Tag id is required." }, { status: 400 });
  }

  const result = await deleteLibraryTagImpl(id);
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}
