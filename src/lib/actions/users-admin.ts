"use server";

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-utils";
import { ASSIGNABLE_ROLES } from "@/lib/auth/permissions";
import type { UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function updateUserRole(userId: string, role: UserRole) {
  const session = await requireAdmin();
  if (!ASSIGNABLE_ROLES.includes(role)) {
    return { error: "Invalid role." };
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, email: true },
  });
  if (!target) return { error: "User not found." };

  if (target.id === session.user.id && role !== "ADMIN") {
    return { error: "You cannot change your own role away from admin." };
  }

  if (target.role === "ADMIN" && role !== "ADMIN") {
    const adminCount = await prisma.user.count({
      where: { role: "ADMIN", archived: false },
    });
    if (adminCount <= 1) {
      return { error: "Cannot remove the last active admin." };
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: { role },
  });

  revalidatePath("/admin/users");
  return { success: true as const };
}
