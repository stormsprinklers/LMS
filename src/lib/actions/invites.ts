"use server";

import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-utils";
import { isInviteActive } from "@/lib/invites/validate";
import { revalidatePath } from "next/cache";

function defaultExpiry(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

export async function createInvite(email: string) {
  const session = await requireAdmin();
  const token = randomBytes(32).toString("hex");

  await prisma.invite.create({
    data: {
      email: email.toLowerCase().trim(),
      token,
      expiresAt: defaultExpiry(7),
      createdById: session.user.id,
      openSignup: false,
    },
  });

  revalidatePath("/admin/users");
  return { token, inviteUrl: `/invite/${token}` };
}

export async function createOpenSignupLink(options?: {
  label?: string;
  expiresInDays?: number;
  maxUses?: number;
}) {
  const session = await requireAdmin();
  const token = randomBytes(32).toString("hex");
  const expiresInDays = options?.expiresInDays ?? 30;
  const maxUses =
    options?.maxUses != null && options.maxUses > 0
      ? Math.floor(options.maxUses)
      : null;

  await prisma.invite.create({
    data: {
      token,
      openSignup: true,
      label: options?.label?.trim() || null,
      maxUses,
      expiresAt: defaultExpiry(expiresInDays),
      createdById: session.user.id,
    },
  });

  revalidatePath("/admin/users");
  return { token, inviteUrl: `/invite/${token}` };
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

export async function acceptInvite(
  token: string,
  name: string,
  password: string,
  email?: string,
) {
  const invite = await prisma.invite.findUnique({ where: { token } });
  if (!invite || !isInviteActive(invite)) {
    return { error: "Invalid or expired invite." };
  }

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const trimmedName = name.trim();
  if (!trimmedName) {
    return { error: "Name is required." };
  }

  let accountEmail: string;
  if (invite.openSignup) {
    if (!email?.trim()) {
      return { error: "Email is required." };
    }
    accountEmail = email.toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(accountEmail)) {
      return { error: "Enter a valid email address." };
    }
  } else {
    if (!invite.email) {
      return { error: "Invalid invite." };
    }
    accountEmail = invite.email;
  }

  const existing = await prisma.user.findUnique({
    where: { email: accountEmail },
  });
  if (existing?.status === "ACTIVE" && existing.passwordHash) {
    return {
      error: "An account with this email already exists. Please sign in instead.",
    };
  }

  const hash = await bcrypt.hash(password, 12);

  await prisma.$transaction(async (tx) => {
    await tx.user.upsert({
      where: { email: accountEmail },
      update: {
        name: trimmedName,
        passwordHash: hash,
        status: "ACTIVE",
      },
      create: {
        email: accountEmail,
        name: trimmedName,
        passwordHash: hash,
        status: "ACTIVE",
        role: "EMPLOYEE",
      },
    });

    if (invite.openSignup) {
      await tx.invite.update({
        where: { id: invite.id },
        data: { useCount: { increment: 1 } },
      });
    } else {
      await tx.invite.update({
        where: { id: invite.id },
        data: { usedAt: new Date() },
      });
    }
  });

  return { success: true };
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
