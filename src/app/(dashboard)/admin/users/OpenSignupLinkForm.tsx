"use client";

import { createOpenSignupLink } from "@/lib/actions/invites";
import { useState } from "react";

const inputClass =
  "w-full min-h-11 rounded-lg border border-storm-light-blue/60 px-3 py-2 text-sm";

export function OpenSignupLinkForm() {
  const [label, setLabel] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("30");
  const [maxUses, setMaxUses] = useState("");
  const [link, setLink] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setLink("");
    const result = await createOpenSignupLink({
      label: label || undefined,
      expiresInDays: Number(expiresInDays) || 30,
      maxUses: maxUses ? Number(maxUses) : undefined,
    });
    setLoading(false);
    if (result.inviteUrl) {
      setLink(`${window.location.origin}${result.inviteUrl}`);
      setLabel("");
      setMaxUses("");
    }
  }

  async function copyLink() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
  }

  return (
    <div className="rounded-xl border border-storm-medium-blue/30 bg-storm-medium-blue/5 p-4 sm:p-5">
      <h3 className="font-medium text-storm-navy">Open signup link</h3>
      <p className="mt-1 text-sm text-storm-navy/60">
        Share one link with a group. Anyone can register with their own email and
        name — not tied to a specific address.
      </p>
      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <label className="block text-sm">
          Label (optional)
          <input
            type="text"
            placeholder="e.g. New hire onboarding"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className={inputClass}
          />
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            Expires in (days)
            <input
              type="number"
              min={1}
              max={365}
              required
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block text-sm">
            Max signups (optional)
            <input
              type="number"
              min={1}
              placeholder="Unlimited"
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
              className={inputClass}
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="min-h-11 rounded-lg bg-storm-medium-blue px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {loading ? "Creating…" : "Create signup link"}
        </button>
      </form>
      {link && (
        <div className="mt-4 rounded-lg border border-storm-light-blue/40 bg-white p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-storm-navy/50">
            Signup link
          </p>
          <p className="mt-1 break-all text-sm text-storm-navy">
            <a href={link} className="text-storm-medium-blue no-underline hover:underline">
              {link}
            </a>
          </p>
          <button
            type="button"
            onClick={() => void copyLink()}
            className="mt-2 text-sm font-medium text-storm-medium-blue"
          >
            Copy link
          </button>
        </div>
      )}
    </div>
  );
}
