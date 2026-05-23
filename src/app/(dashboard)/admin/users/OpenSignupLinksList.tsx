"use client";

import { revokeOpenSignupLink } from "@/lib/actions/invites";
import { inviteStatusLabel } from "@/lib/invites/validate";
import type { Invite } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function OpenSignupLinksList({ links }: { links: Invite[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  if (links.length === 0) return null;

  async function handleRevoke(id: string) {
    if (!confirm("Revoke this signup link? New signups will no longer work.")) {
      return;
    }
    setBusyId(id);
    await revokeOpenSignupLink(id);
    setBusyId(null);
    router.refresh();
  }

  return (
    <section className="mt-8">
      <h2 className="font-title text-lg font-bold text-storm-navy">
        Open signup links
      </h2>
      <ul className="mt-3 space-y-3">
        {links.map((link) => {
          const status = inviteStatusLabel(link);
          const active = status === "Active";

          return (
            <li
              key={link.id}
              className="rounded-xl border bg-white px-4 py-3 text-sm"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium text-storm-navy">
                    {link.label ?? "Open signup link"}
                  </p>
                  <p className="mt-1 break-all text-xs text-storm-medium-blue">
                    /invite/{link.token}
                  </p>
                  <p className="mt-2 text-storm-navy/60">
                    {status}
                    {link.maxUses != null
                      ? ` · ${link.useCount}/${link.maxUses} used`
                      : link.useCount > 0
                        ? ` · ${link.useCount} signup${link.useCount === 1 ? "" : "s"}`
                        : ""}
                    {" · "}
                    Expires {new Date(link.expiresAt).toLocaleDateString()}
                  </p>
                </div>
                {active && (
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        void navigator.clipboard.writeText(
                          `${window.location.origin}/invite/${link.token}`,
                        )
                      }
                      className="min-h-10 rounded-lg border border-storm-light-blue/60 px-3 py-2 text-sm font-medium text-storm-navy"
                    >
                      Copy
                    </button>
                    <button
                      type="button"
                      disabled={busyId === link.id}
                      onClick={() => void handleRevoke(link.id)}
                      className="min-h-10 rounded-lg border border-storm-pink/50 px-3 py-2 text-sm font-medium text-storm-pink disabled:opacity-50"
                    >
                      Revoke
                    </button>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
