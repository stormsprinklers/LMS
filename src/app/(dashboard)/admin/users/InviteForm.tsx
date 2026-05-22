"use client";

import { createInvite } from "@/lib/actions/invites";
import { useState } from "react";

export function InviteForm() {
  const [email, setEmail] = useState("");
  const [link, setLink] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const result = await createInvite(email);
    setLoading(false);
    if (result.inviteUrl) {
      setLink(`${window.location.origin}${result.inviteUrl}`);
      setEmail("");
    }
  }

  return (
    <div className="rounded-xl border bg-white p-4">
      <form onSubmit={handleSubmit} className="flex flex-wrap gap-2">
        <input
          type="email"
          required
          placeholder="employee@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="min-w-[240px] flex-1 rounded border px-3 py-2"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-storm-medium-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Create invite
        </button>
      </form>
      {link && (
        <p className="mt-3 break-all text-sm text-storm-navy">
          Invite link: <a href={link} className="text-storm-medium-blue">{link}</a>
        </p>
      )}
    </div>
  );
}
