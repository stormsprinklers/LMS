"use client";

import { createInvite } from "@/lib/actions/invites";
import { useState } from "react";

export function InviteForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const result = await createInvite(email);
    setLoading(false);
    if ("error" in result && result.error) {
      setError(result.error);
      return;
    }
  }

  return (
    <div className="rounded-xl border bg-white p-4">
      <p className="mb-3 text-sm text-storm-navy/70">
        LMS accounts are provisioned from the CRM. Create the employee there
        (email, password, mobile phone for SMS 2FA) and sync to LMS.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-wrap gap-2">
        <input
          type="email"
          required
          placeholder="employee@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="min-w-[240px] flex-1 rounded border px-3 py-2"
          disabled
        />
        <button
          type="submit"
          disabled
          className="rounded-lg bg-storm-medium-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Create invite
        </button>
      </form>
      {error && <p className="mt-3 text-sm text-storm-pink">{error}</p>}
    </div>
  );
}
