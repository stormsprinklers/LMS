"use client";

import { markSkillCheckComplete } from "@/lib/actions/course-builder";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SkillCheckGradeForm({
  skillCheckId,
  users,
  completions,
}: {
  skillCheckId: string;
  users: { id: string; email: string; name: string | null }[];
  completions: {
    userId: string;
    passed: boolean;
    user: { name: string | null; email: string };
  }[];
}) {
  const router = useRouter();
  const [userId, setUserId] = useState(users[0]?.id ?? "");
  const [busy, setBusy] = useState(false);

  async function submit(passed: boolean) {
    if (!userId) return;
    setBusy(true);
    await markSkillCheckComplete(skillCheckId, userId, passed);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="mt-3 space-y-2">
      {completions.length > 0 && (
        <ul className="text-xs text-storm-navy/70">
          {completions.map((c) => (
            <li key={c.userId}>
              {c.user.name ?? c.user.email}: {c.passed ? "Passed" : "Not passed"}
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        <select
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          className="min-h-10 rounded-lg border px-2 text-sm"
        >
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name ?? u.email}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={busy}
          onClick={() => submit(true)}
          className="min-h-10 rounded-lg bg-green-600 px-3 text-sm text-white"
        >
          Pass
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => submit(false)}
          className="min-h-10 rounded-lg border px-3 text-sm"
        >
          Fail
        </button>
      </div>
    </div>
  );
}
