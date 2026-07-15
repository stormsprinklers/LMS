import { NextRequest, NextResponse } from "next/server";
import {
  crmStaffLogin,
  crmStaffMfaResend,
  crmStaffMfaVerify,
} from "@/lib/crm-auth";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const action = String(body.action ?? "login");

  if (action === "login") {
    const email = String(body.email ?? "");
    const password = String(body.password ?? "");
    if (!email.trim() || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 },
      );
    }
    const result = await crmStaffLogin(email, password);
    if ("error" in result && result.error) {
      return NextResponse.json(
        { error: result.error, code: result.code },
        { status: result.code === "INVALID" ? 401 : 400 },
      );
    }
    return NextResponse.json(result);
  }

  if (action === "mfa") {
    const challengeId = String(body.challengeId ?? "");
    const code = String(body.code ?? "");
    if (!challengeId || !code.trim()) {
      return NextResponse.json(
        { error: "Verification code is required." },
        { status: 400 },
      );
    }
    const result = await crmStaffMfaVerify(challengeId, code);
    if ("error" in result && result.error) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }
    return NextResponse.json(result);
  }

  if (action === "resend") {
    const challengeId = String(body.challengeId ?? "");
    if (!challengeId) {
      return NextResponse.json({ error: "Challenge required." }, { status: 400 });
    }
    const result = await crmStaffMfaResend(challengeId);
    if ("error" in result && result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
