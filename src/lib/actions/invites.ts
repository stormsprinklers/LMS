"use server";

import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-utils";
import { revalidatePath } from "next/cache";

export async function createInvite(email: string) {
  const session = await requireAdmin();
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.invite.create({
    data: {
      email: email.toLowerCase().trim(),
      token,
      expiresAt,
      createdById: session.user.id,
    },
  });

  revalidatePath("/admin/users");
  return { token, inviteUrl: `/invite/${token}` };
}

export async function acceptInvite(
  token: string,
  name: string,
  password: string,
) {
  const invite = await prisma.invite.findUnique({ where: { token } });
  if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
    return { error: "Invalid or expired invite." };
  }

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const hash = await bcrypt.hash(password, 12);
  const email = invite.email;

  await prisma.$transaction(async (tx) => {
    await tx.user.upsert({
      where: { email },
      update: {
        name,
        passwordHash: hash,
        status: "ACTIVE",
      },
      create: {
        email,
        name,
        passwordHash: hash,
        status: "ACTIVE",
        role: "EMPLOYEE",
      },
    });
    await tx.invite.update({
      where: { id: invite.id },
      data: { usedAt: new Date() },
    });
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
      createdAt: true,
    },
  });
}
