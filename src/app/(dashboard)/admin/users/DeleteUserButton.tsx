"use client";

import { deleteUser } from "@/lib/actions/admin-entity";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2 } from "lucide-react";

export function DeleteUserButton({
  userId,
  email,
  displayName,
  disabled = false,
  disabledReason,
}: {
  userId: string;
  email: string;
  displayName: string;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const emailMatches =
    confirmEmail.trim().toLowerCase() === email.trim().toLowerCase();

  async function handleDelete() {
    if (!emailMatches) return;
    setBusy(true);
    setError("");
    const result = await deleteUser(userId);
    setBusy(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setOpen(false);
    setConfirmEmail("");
    router.refresh();
  }

  if (disabled) {
    return disabledReason ? (
      <p className="text-xs text-storm-navy/50">{disabledReason}</p>
    ) : null;
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
      >
        <Trash2 className="h-4 w-4" />
        Delete user
      </button>
    );
  }

  return (
    <div className="w-full max-w-md rounded-xl border border-red-200 bg-red-50/50 p-4 space-y-3">
      <p className="text-sm font-medium text-red-900">Permanently delete user?</p>
      <p className="text-sm text-red-800">
        <strong>{displayName}</strong> ({email}) will lose access immediately and their
        account will be removed. This cannot be undone.
      </p>
      <label className="block text-sm text-red-900">
        Type <strong>{email}</strong> to confirm
        <input
          type="email"
          value={confirmEmail}
          onChange={(e) => setConfirmEmail(e.target.value)}
          autoComplete="off"
          placeholder={email}
          className="mt-1 w-full min-h-10 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm text-storm-navy"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !emailMatches}
          onClick={() => void handleDelete()}
          className="min-h-10 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Deleting…" : "Yes, delete permanently"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setOpen(false);
            setConfirmEmail("");
            setError("");
          }}
          className="min-h-10 rounded-lg border border-storm-light-blue/60 bg-white px-4 py-2 text-sm font-medium text-storm-navy"
        >
          Cancel
        </button>
      </div>
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
