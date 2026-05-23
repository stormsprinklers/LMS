"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

function revalidateNotifications() {
  revalidatePath("/notifications");
  revalidatePath("/", "layout");
}

export async function getUnreadNotificationCount() {
  const session = await auth();
  if (!session?.user?.id) return 0;
  return prisma.notification.count({
    where: { userId: session.user.id, readAt: null },
  });
}

export async function markNotificationRead(notificationId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };

  await prisma.notification.updateMany({
    where: { id: notificationId, userId: session.user.id },
    data: { readAt: new Date() },
  });

  revalidateNotifications();
  return { success: true as const };
}

export async function markAllNotificationsRead() {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };

  await prisma.notification.updateMany({
    where: { userId: session.user.id, readAt: null },
    data: { readAt: new Date() },
  });

  revalidateNotifications();
  return { success: true as const };
}
