"use server";

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-utils";
import { revalidatePath } from "next/cache";

/** Local LMS invites/signup are disabled — CRM owns identity. */
export async function acceptInvite(
  _token: string,
  _name: string,
  _password: string,
  _email?: string,
) {
  return {
    error:
      "LMS accounts are created and synced from the CRM. Sign in with your CRM email and password after an admin adds you in the CRM.",
  };
}

export async function createInvite(_email: string) {
  await requireAdmin();
  return {
    error:
      "User invites are disabled. Create the employee in the CRM and sync them to the LMS.",
  };
}

export async function createOpenSignupLink(_options?: {
  label?: string;
  expiresInDays?: number;
  maxUses?: number;
}) {
  await requireAdmin();
  return {
    error:
      "Open signup is disabled. Create employees in the CRM; they sign in here with CRM credentials and SMS 2FA.",
  };
}

export async function revokeOpenSignupLink(inviteId: string) {
  await requireAdmin();
  const invite = await prisma.invite.findUnique({ where: { id: inviteId } });
  if (!invite?.openSignup) return { error: "Not an open signup link." };
  if (invite.usedAt) return { error: "Link is already revoked." };

  await prisma.invite.update({
    where: { id: inviteId },
    data: { usedAt: new Date() },
  });
  revalidatePath("/admin/users");
  return { success: true as const };
}

export async function listInvites() {
  await requireAdmin();
  return prisma.invite.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function listUsers() {
  await requireAdmin();
  return prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      jobRole: true,
      archived: true,
      createdAt: true,
    },
  });
}
