import { auth } from "@/auth";
import { redirect } from "next/navigation";

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session;
}

export async function requireAdmin() {
  const session = await requireUser();
  const role = (session.user as { role?: string }).role;
  if (role !== "ADMIN") redirect("/");
  return session;
}

export async function getUserId() {
  const session = await auth();
  return session?.user?.id ?? null;
}
