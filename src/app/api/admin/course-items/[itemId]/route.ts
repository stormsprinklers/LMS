import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-utils";
import { getCourseItemDetail } from "@/lib/repositories/course-builder";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  try {
    await requireAdmin();
    const { itemId } = await params;
    const item = await getCourseItemDetail(itemId);
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(item);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
