import { isStaff } from "@/lib/auth/permissions";

export function isCoursePreviewRequest(
  previewParam: string | undefined,
  role: string | undefined,
): boolean {
  return previewParam === "1" && isStaff(role);
}
