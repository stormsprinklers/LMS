"use client";

import { updateUserRole } from "@/lib/actions/users-admin";
import { roleLabel } from "@/lib/auth/permissions";
import type { UserRole } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

const ROLES: UserRole[] = ["EMPLOYEE", "MANAGER", "ADMIN", "COURSE_ADMIN"];

export function UserRoleSelect({
  userId,
  currentRole,
  isSelf,
}: {
  userId: string;
  currentRole: UserRole;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [role, setRole] = useState(currentRole);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleChange(next: UserRole) {
    if (next === role) return;
    setBusy(true);
    setError("");
    const result = await updateUserRole(userId, next);
    setBusy(false);
    if (result?.error) {
      setError(result.error);
      setRole(currentRole);
      return;
    }
    setRole(next);
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <select
        value={role}
        disabled={busy || isSelf}
        onChange={(e) => void handleChange(e.target.value as UserRole)}
        className="min-h-10 rounded-lg border border-storm-light-blue/60 px-3 py-2 text-sm disabled:opacity-50"
        aria-label="User role"
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {roleLabel(r)}
          </option>
        ))}
      </select>
      {isSelf && (
        <span className="text-xs text-storm-navy/50">Your role is fixed here</span>
      )}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
