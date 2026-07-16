import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authenticateIntegrationRequest } from "@/lib/integrations/auth";

/** Lightweight CRM→LMS connectivity check (auth + DB + CRM sync columns). */
export async function GET(request: NextRequest) {
  const auth = authenticateIntegrationRequest(request);
  if (auth !== true) return auth;

  try {
    await prisma.$queryRaw`SELECT 1`;

    // Fail loudly if CRM sync columns were never migrated (common cause of sync 500s).
    try {
      await prisma.$queryRaw`SELECT "crmUserId" FROM "User" LIMIT 0`;
    } catch {
      return NextResponse.json(
        {
          ok: false,
          database: true,
          crmSyncColumns: false,
          error:
            "LMS database is missing CRM sync columns. Run npm run db:migrate:deploy on LMS.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json({ ok: true, database: true, crmSyncColumns: true });
  } catch (error) {
    console.error("LMS integration health DB check failed:", error);
    return NextResponse.json(
      {
        ok: false,
        database: false,
        error: "LMS database is unreachable",
      },
      { status: 503 }
    );
  }
}
