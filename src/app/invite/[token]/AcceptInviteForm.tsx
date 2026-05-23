"use client";

import { acceptInvite } from "@/lib/actions/invites";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function AcceptInviteForm({
  token,
  openSignup = false,
  prefillEmail,
}: {
  token: string;
  openSignup?: boolean;
  prefillEmail?: string | null;
}) {
  const router = useRouter();
  const [email, setEmail] = useState(prefillEmail ?? "");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    setError("");
    const result = await acceptInvite(
      token,
      name,
      password,
      openSignup ? email : undefined,
    );
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.push("/login?registered=1");
  }

  const inputClass =
    "mt-1 w-full min-h-11 rounded-lg border border-storm-light-blue/60 px-3 py-2 text-sm";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-storm-pink/15 px-3 py-2 text-sm text-storm-navy"
        >
          {error}
        </p>
      )}
      {openSignup && (
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-storm-navy">
            Work email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </div>
      )}
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-storm-navy">
          Full name
        </label>
        <input
          id="name"
          required
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-storm-navy">
          Password
        </label>
        <input
          id="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="confirm" className="block text-sm font-medium text-storm-navy">
          Confirm password
        </label>
        <input
          id="confirm"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className={inputClass}
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="min-h-11 w-full rounded-lg bg-storm-pink py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
      >
        {loading ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
