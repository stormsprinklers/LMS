"use client";

import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

type Step = "credentials" | "mfa";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/";
  const crmForgotUrl = useMemo(() => {
    const base =
      process.env.NEXT_PUBLIC_CRM_URL?.replace(/\/$/, "") || "";
    return base ? `${base}/forgot-password` : null;
  }, []);

  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [phoneMasked, setPhoneMasked] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/crm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "login",
          email: email.trim().toLowerCase(),
          password,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        challengeId?: string;
        phoneMasked?: string;
        debugCode?: string;
      };
      if (!res.ok || !data.challengeId) {
        setError(data.error ?? "Invalid email or password.");
        return;
      }
      setChallengeId(data.challengeId);
      setPhoneMasked(data.phoneMasked ?? "");
      if (data.debugCode) setCode(data.debugCode);
      setStep("mfa");
    } catch {
      setError("Sign in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleMfa(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/crm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "mfa",
          challengeId,
          code: code.trim(),
        }),
      });
      const data = (await res.json()) as { error?: string; ticket?: string };
      if (!res.ok || !data.ticket) {
        setError(data.error ?? "Invalid verification code.");
        return;
      }

      const result = await signIn("credentials", {
        ticket: data.ticket,
        redirect: false,
      });

      if (result?.error) {
        setError(
          "Your CRM account is not linked to the LMS yet. Ask an admin to sync you from the CRM.",
        );
        return;
      }

      router.push(callbackUrl);
      router.refresh();
    } catch {
      setError("Sign in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function resendCode() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/crm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resend", challengeId }),
      });
      const data = (await res.json()) as {
        error?: string;
        challengeId?: string;
        phoneMasked?: string;
        debugCode?: string;
      };
      if (!res.ok || !data.challengeId) {
        setError(data.error ?? "Could not resend code.");
        return;
      }
      setChallengeId(data.challengeId);
      setPhoneMasked(data.phoneMasked ?? phoneMasked);
      if (data.debugCode) setCode(data.debugCode);
    } catch {
      setError("Could not resend code.");
    } finally {
      setLoading(false);
    }
  }

  if (step === "mfa") {
    return (
      <form onSubmit={handleMfa} className="space-y-4">
        {error && (
          <p className="rounded-lg bg-storm-pink/15 px-3 py-2 text-sm text-storm-navy">
            {error}
          </p>
        )}
        <p className="text-sm text-storm-navy/70">
          Enter the 6-digit code texted to {phoneMasked || "your phone"}.
        </p>
        <div>
          <label htmlFor="code" className="block text-sm font-medium text-storm-navy">
            Verification code
          </label>
          <input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="mt-1 w-full rounded-lg border border-storm-light-blue px-3 py-2 text-storm-navy focus:border-storm-medium-blue focus:outline-none focus:ring-1 focus:ring-storm-medium-blue"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-storm-medium-blue py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Verifying…" : "Verify and sign in"}
        </button>
        <div className="flex justify-between text-sm">
          <button
            type="button"
            className="text-storm-medium-blue hover:underline"
            onClick={() => {
              setStep("credentials");
              setCode("");
              setError("");
            }}
            disabled={loading}
          >
            Back
          </button>
          <button
            type="button"
            className="text-storm-medium-blue hover:underline"
            onClick={() => void resendCode()}
            disabled={loading}
          >
            Resend code
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={handleCredentials} className="space-y-4">
      {error && (
        <p className="rounded-lg bg-storm-pink/15 px-3 py-2 text-sm text-storm-navy">
          {error}
        </p>
      )}
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-storm-navy">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          className="mt-1 w-full rounded-lg border border-storm-light-blue px-3 py-2 text-storm-navy focus:border-storm-medium-blue focus:outline-none focus:ring-1 focus:ring-storm-medium-blue"
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
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          className="mt-1 w-full rounded-lg border border-storm-light-blue px-3 py-2 text-storm-navy focus:border-storm-medium-blue focus:outline-none focus:ring-1 focus:ring-storm-medium-blue"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-storm-medium-blue py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {loading ? "Checking…" : "Continue"}
      </button>
      {crmForgotUrl ? (
        <p className="text-center text-sm">
          <a
            href={crmForgotUrl}
            className="text-storm-medium-blue no-underline hover:underline"
          >
            Forgot password?
          </a>
        </p>
      ) : (
        <p className="text-center text-xs text-storm-navy/50">
          Password reset is managed in the CRM.
        </p>
      )}
      <p className="text-center text-xs text-storm-navy/50">
        Use the same email and password as the CRM. Accounts must be created in the
        CRM first.
      </p>
    </form>
  );
}
