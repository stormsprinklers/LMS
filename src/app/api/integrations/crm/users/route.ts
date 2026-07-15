import { NextRequest, NextResponse } from "next/server";
import { UserRole, UserStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { authenticateIntegrationRequest } from "@/lib/integrations/auth";

function mapLmsRole(role: string): UserRole {
  if (role === "ADMIN") return UserRole.ADMIN;
  if (role === "MANAGER") return UserRole.MANAGER;
  return UserRole.EMPLOYEE;
}

export async function POST(request: NextRequest) {
  const auth = authenticateIntegrationRequest(request);
  if (auth !== true) return auth;

  const body = await request.json();
  const crmUserId = String(body.crmUserId ?? "").trim();
  const email = String(body.email ?? "").toLowerCase().trim();
  const name = String(body.name ?? "").trim() || email;
  const archived = Boolean(body.archived);

  if (!crmUserId || !email) {
    return NextResponse.json({ error: "crmUserId and email required" }, { status: 400 });
  }

  const existingByCrm = await prisma.user.findFirst({ where: { crmUserId } });
  const existingByEmail = await prisma.user.findUnique({ where: { email } });
  const existing = existingByCrm ?? existingByEmail;

  const data = {
    email,
    name,
    role: mapLmsRole(String(body.role ?? "EMPLOYEE")),
    crmUserId,
    crmSyncStatus: "synced",
    crmLastSyncedAt: new Date(),
    archived,
    archivedAt: archived ? new Date() : null,
    status: archived ? UserStatus.DISABLED : UserStatus.ACTIVE,
  };

  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: { ...data, passwordHash: null },
      })
    : await prisma.user.create({
        data: {
          ...data,
          passwordHash: null,
        },
      });

  return NextResponse.json({ lmsUserId: user.id, crmUserId: user.crmUserId });
}
