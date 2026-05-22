"use client";

import { useMemo, useState } from "react";

export function UserAssignmentList({
  users,
  assignedIds,
  onToggle,
}: {
  users: { id: string; email: string; name: string | null }[];
  assignedIds: Set<string>;
  onToggle: (userId: string, checked: boolean) => void | Promise<void>;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        (u.name?.toLowerCase().includes(q) ?? false),
    );
  }, [users, query]);

  return (
    <div className="space-y-3">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search learners…"
        className="w-full min-h-11 rounded-lg border border-storm-light-blue/60 px-3 py-2 text-sm"
        aria-label="Search learners"
      />
      <div className="max-h-56 overflow-y-auto space-y-1 rounded-lg border border-storm-light-blue/40 p-2">
        {filtered.map((u) => (
          <label
            key={u.id}
            className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-storm-light-grey/50"
          >
            <input
              type="checkbox"
              className="h-5 w-5 shrink-0"
              checked={assignedIds.has(u.id)}
              onChange={(e) => onToggle(u.id, e.target.checked)}
            />
            <span className="min-w-0 truncate">{u.name ?? u.email}</span>
          </label>
        ))}
        {filtered.length === 0 && (
          <p className="px-2 py-4 text-center text-sm text-storm-navy/50">No matches</p>
        )}
      </div>
    </div>
  );
}
