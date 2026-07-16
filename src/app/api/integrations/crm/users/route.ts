import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { Prisma, UserRole, UserStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { authenticateIntegrationRequest } from "@/lib/integrations/auth";

const MAX_PHOTO_BYTES = 1_500_000;

function mapLmsRole(role: string): UserRole {
  if (role === "ADMIN") return UserRole.ADMIN;
  if (role === "MANAGER") return UserRole.MANAGER;
  return UserRole.EMPLOYEE;
}

function resolveRole(existingRole: UserRole | undefined, crmRole: string): UserRole {
  const mapped = mapLmsRole(crmRole);
  // Keep LMS-only COURSE_ADMIN unless CRM is explicitly promoting to ADMIN/MANAGER.
  if (existingRole === UserRole.COURSE_ADMIN && mapped === UserRole.EMPLOYEE) {
    return UserRole.COURSE_ADMIN;
  }
  return mapped;
}

function prismaErrorMessage(error: unknown): string {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return "A user with this email or CRM id already exists with conflicting data";
    }
    if (error.code === "P2022") {
      return "LMS database is missing CRM sync columns. Run npm run db:migrate:deploy on LMS (or apply scripts/fix-production-schema.sql).";
    }
    return `Database error ${error.code}`;
  }
  if (error instanceof Prisma.PrismaClientValidationError) {
    return "Invalid user data for LMS schema";
  }
  const msg = error instanceof Error ? error.message : String(error);
  if (/crmUserId|crmSyncStatus|crmLastSyncedAt|photoUrl|column .* does not exist/i.test(msg)) {
    return "LMS database is missing CRM sync columns. Run npm run db:migrate:deploy on LMS (or apply scripts/fix-production-schema.sql).";
  }
  return msg.slice(0, 300) || "Failed to sync user";
}

function extensionForMime(mime: string): string {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  return "jpg";
}

async function resolvePhotoUrl(input: {
  crmUserId: string;
  photoBase64?: string;
  photoMimeType?: string;
  clearPhoto?: boolean;
}): Promise<string | null | undefined> {
  // undefined = leave unchanged; null = clear
  if (input.clearPhoto && !input.photoBase64) return null;
  if (!input.photoBase64) return undefined;

  if (!process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    console.warn("LMS photo sync skipped: BLOB_READ_WRITE_TOKEN not configured");
    return undefined;
  }

  const mime = (input.photoMimeType || "image/jpeg").split(";")[0].trim() || "image/jpeg";
  if (!mime.startsWith("image/")) {
    console.warn("LMS photo sync skipped: non-image mime", mime);
    return undefined;
  }

  const buffer = Buffer.from(input.photoBase64, "base64");
  if (!buffer.length || buffer.length > MAX_PHOTO_BYTES) {
    console.warn("LMS photo sync skipped: invalid size", buffer.length);
    return undefined;
  }

  const ext = extensionForMime(mime);
  const blob = await put(`employees/${input.crmUserId}/photo.${ext}`, buffer, {
    access: "public",
    token: process.env.BLOB_READ_WRITE_TOKEN,
    contentType: mime,
    addRandomSuffix: true,
  });
  return blob.url;
}

export async function POST(request: NextRequest) {
  const auth = authenticateIntegrationRequest(request);
  if (auth !== true) return auth;

  try {
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

    if (existingByCrm && existingByEmail && existingByCrm.id !== existingByEmail.id) {
      return NextResponse.json(
        {
          error:
            "Email and CRM user id map to different LMS users. Resolve the duplicate in LMS admin.",
        },
        { status: 409 }
      );
    }

    const existing = existingByCrm ?? existingByEmail;

    let photoUrl: string | null | undefined;
    try {
      photoUrl = await resolvePhotoUrl({
        crmUserId,
        photoBase64:
          typeof body.photoBase64 === "string" ? body.photoBase64 : undefined,
        photoMimeType:
          typeof body.photoMimeType === "string" ? body.photoMimeType : undefined,
        clearPhoto: Boolean(body.clearPhoto),
      });
    } catch (photoError) {
      console.error("LMS photo sync failed (continuing without photo):", photoError);
      photoUrl = undefined;
    }

    const data = {
      email,
      name,
      role: resolveRole(existing?.role, String(body.role ?? "EMPLOYEE")),
      crmUserId,
      crmSyncStatus: "synced",
      crmLastSyncedAt: new Date(),
      archived,
      archivedAt: archived ? new Date() : null,
      status: archived ? UserStatus.DISABLED : UserStatus.ACTIVE,
      ...(photoUrl !== undefined ? { photoUrl } : {}),
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

    return NextResponse.json({
      lmsUserId: user.id,
      crmUserId: user.crmUserId,
      email: user.email,
      role: user.role,
      name: user.name,
      photoUrl: user.photoUrl,
    });
  } catch (error) {
    console.error("CRM user sync failed:", error);
    const message = prismaErrorMessage(error);
    const status =
      error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
        ? 409
        : /missing CRM sync columns/i.test(message)
          ? 503
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
