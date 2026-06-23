import { NextResponse } from "next/server";

const INTEGRATION_KEY = process.env.INTEGRATION_API_KEY ?? process.env.CRM_INTEGRATION_KEY ?? "";

export function extractIntegrationKey(request: Request): string | null {
  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7).trim();
    if (token) return token;
  }
  const headerKey = request.headers.get("x-integration-key");
  if (headerKey?.trim()) return headerKey.trim();
  return null;
}

export function authenticateIntegrationRequest(request: Request): true | NextResponse {
  if (!INTEGRATION_KEY) {
    return NextResponse.json({ error: "Integration not configured" }, { status: 503 });
  }
  const key = extractIntegrationKey(request);
  if (!key || key !== INTEGRATION_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return true;
}
