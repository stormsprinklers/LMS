import { jwtVerify } from "jose";

function crmBaseUrl() {
  return (
    process.env.CRM_AUTH_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_CRM_URL?.replace(/\/$/, "") ||
    ""
  );
}

function ticketSecret() {
  const shared =
    process.env.STAFF_AUTH_TICKET_SECRET?.trim() ||
    process.env.INTEGRATION_API_KEY?.trim() ||
    process.env.CRM_INTEGRATION_KEY?.trim() ||
    process.env.AUTH_SECRET?.trim();
  if (!shared) throw new Error("STAFF_AUTH_TICKET_SECRET is not configured");
  return new TextEncoder().encode(shared);
}

export function getCrmAuthBaseUrl() {
  return crmBaseUrl();
}

export async function crmStaffLogin(email: string, password: string) {
  const base = crmBaseUrl();
  if (!base) {
    return { error: "CRM auth is not configured (CRM_AUTH_URL / NEXT_PUBLIC_CRM_URL)." };
  }
  const res = await fetch(`${base}/api/auth/staff/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password,
      purpose: "LMS_LOGIN",
    }),
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    code?: string;
    challengeId?: string;
    phoneMasked?: string;
    debugCode?: string;
  };
  if (!res.ok) {
    return { error: data.error ?? "Invalid email or password.", code: data.code };
  }
  return {
    challengeId: data.challengeId!,
    phoneMasked: data.phoneMasked ?? "",
    debugCode: data.debugCode,
  };
}

export async function crmStaffMfaVerify(challengeId: string, code: string) {
  const base = crmBaseUrl();
  if (!base) {
    return { error: "CRM auth is not configured." };
  }
  const res = await fetch(`${base}/api/auth/staff/mfa`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      challengeId,
      code,
      purpose: "LMS_LOGIN",
    }),
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    ticket?: string;
  };
  if (!res.ok || !data.ticket) {
    return { error: data.error ?? "Invalid verification code." };
  }
  return { ticket: data.ticket };
}

export async function crmStaffMfaResend(challengeId: string) {
  const base = crmBaseUrl();
  if (!base) {
    return { error: "CRM auth is not configured." };
  }
  const res = await fetch(`${base}/api/auth/staff/mfa`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      challengeId,
      purpose: "LMS_LOGIN",
    }),
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    challengeId?: string;
    phoneMasked?: string;
    debugCode?: string;
  };
  if (!res.ok || !data.challengeId) {
    return { error: data.error ?? "Could not resend code." };
  }
  return {
    challengeId: data.challengeId,
    phoneMasked: data.phoneMasked ?? "",
    debugCode: data.debugCode,
  };
}

export async function verifyCrmLmsTicket(ticket: string) {
  const { payload } = await jwtVerify(ticket, ticketSecret(), {
    audience: "lms-staff-auth",
  });
  const crmUserId = String(payload.sub ?? "");
  const email = String(payload.email ?? "").toLowerCase();
  if (!crmUserId || !email) throw new Error("Invalid ticket");
  return {
    crmUserId,
    email,
    name: payload.name ? String(payload.name) : null,
    role: payload.role ? String(payload.role) : "EMPLOYEE",
  };
}
