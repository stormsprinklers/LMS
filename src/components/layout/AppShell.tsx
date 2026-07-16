import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getUnreadNotificationCount } from "@/lib/actions/notifications";
import { MobileShell } from "./MobileShell";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const name = session?.user?.name ?? "Team Member";
  const role = (session?.user as { role?: string })?.role ?? "EMPLOYEE";
  const unread = session?.user?.id
    ? await getUnreadNotificationCount()
    : 0;
  const photoUrl = session?.user?.id
    ? (
        await prisma.user.findUnique({
          where: { id: session.user.id },
          select: { photoUrl: true },
        })
      )?.photoUrl ??
      session.user.image ??
      null
    : null;

  return (
    <MobileShell
      unread={unread}
      userName={name}
      userRole={role}
      userImageUrl={photoUrl}
    >
      {children}
    </MobileShell>
  );
}
