import { auth } from "@/auth";
import { getUnreadNotificationCount } from "@/lib/actions/grading";
import { MobileShell } from "./MobileShell";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const name = session?.user?.name ?? "Team Member";
  const role = (session?.user as { role?: string })?.role ?? "EMPLOYEE";
  const unread = session?.user?.id
    ? await getUnreadNotificationCount()
    : 0;

  return (
    <MobileShell unread={unread} userName={name} userRole={role}>
      {children}
    </MobileShell>
  );
}
