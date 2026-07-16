import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authenticateIntegrationRequest } from "@/lib/integrations/auth";

/** Lightweight CRM→LMS connectivity check (auth + optional DB ping). */
export async function GET(request: NextRequest) {
  const auth = authenticateIntegrationRequest(request);
  if (auth !== true) return auth;

  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, database: true });
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
