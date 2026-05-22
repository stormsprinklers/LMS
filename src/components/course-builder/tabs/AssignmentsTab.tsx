"use client";

import {
  assignCourseToUsers,
  assignCourseToRole,
  assignCourseToAll,
} from "@/lib/actions/course-builder";
import { useRouter } from "next/navigation";
import { useState } from "react";

const inputClass =
  "mt-1 w-full min-h-11 rounded-lg border border-storm-light-blue/60 px-3 py-2 text-sm";

export function AssignmentsTab({
  courseId,
  users,
}: {
  courseId: string;
  users: { id: string; email: string; name: string | null; jobRole: string | null }[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [role, setRole] = useState("");
  const [dueDays, setDueDays] = useState(14);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function assignSelected() {
    if (selected.length === 0) return;
    setBusy(true);
    await assignCourseToUsers(courseId, selected, dueDays);
    setMsg(`Assigned to ${selected.length} user(s).`);
    setBusy(false);
    router.refresh();
  }

  async function assignRole() {
    if (!role) return;
    setBusy(true);
    await assignCourseToRole(courseId, role);
    setMsg(`Assigned to role: ${role}`);
    setBusy(false);
    router.refresh();
  }

  async function assignAll() {
    setBusy(true);
    await assignCourseToAll(courseId);
    setMsg("Assigned to all active employees.");
    setBusy(false);
    router.refresh();
  }

  const roles = [...new Set(users.map((u) => u.jobRole).filter(Boolean))] as string[];

  return (
    <div className="max-w-2xl space-y-6">
      <div className="rounded-xl border bg-white p-4 sm:p-6 space-y-4">
        <h2 className="font-medium text-storm-navy">Assign course</h2>
        <label className="block text-sm">
          Due in (days after assignment, 0 = none)
          <input
            type="number"
            min={0}
            value={dueDays}
            onChange={(e) => setDueDays(Number(e.target.value))}
            className={inputClass}
          />
        </label>
        <div className="max-h-64 overflow-y-auto rounded-lg border p-2 space-y-1">
          {users.map((u) => (
            <label key={u.id} className="flex min-h-10 cursor-pointer items-center gap-2 px-2 text-sm">
              <input
                type="checkbox"
                checked={selected.includes(u.id)}
                onChange={(e) => {
                  setSelected((s) =>
                    e.target.checked ? [...s, u.id] : s.filter((id) => id !== u.id),
                  );
                }}
                className="h-4 w-4"
              />
              <span>
                {u.name ?? u.email}
                {u.jobRole && (
                  <span className="text-storm-navy/50"> · {u.jobRole}</span>
                )}
              </span>
            </label>
          ))}
        </div>
        <button
          type="button"
          disabled={busy || selected.length === 0}
          onClick={assignSelected}
          className="min-h-11 w-full rounded-lg bg-storm-medium-blue text-sm font-semibold text-white disabled:opacity-50"
        >
          Assign to selected users
        </button>
      </div>
      <div className="rounded-xl border bg-white p-4 space-y-3">
        <h3 className="text-sm font-medium text-storm-navy">Assign by role</h3>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className={inputClass}
        >
          <option value="">Select role…</option>
          {roles.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={busy || !role}
          onClick={assignRole}
          className="min-h-10 w-full rounded-lg border border-storm-medium-blue text-sm font-medium text-storm-medium-blue"
        >
          Assign to role
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={assignAll}
          className="min-h-10 w-full rounded-lg border text-sm text-storm-navy/70"
        >
          Assign to all employees
        </button>
      </div>
      {msg && <p className="text-sm text-green-700">{msg}</p>}
    </div>
  );
}
