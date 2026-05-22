import { requireAdminOrCourseAdmin } from "@/lib/auth-utils";

export default async function GradingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdminOrCourseAdmin();
  return <>{children}</>;
}
