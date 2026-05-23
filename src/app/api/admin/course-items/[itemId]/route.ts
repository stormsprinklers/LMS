import { auth } from "@/auth";
import { canManageCourseItem } from "@/lib/auth/permissions";
import { getCourseItemDetail } from "@/lib/repositories/course-builder";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { itemId } = await params;
  const role = (session.user as { role?: string }).role;

  if (!(await canManageCourseItem(session.user.id, role, itemId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const item = await getCourseItemDetail(itemId);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(item);
}
