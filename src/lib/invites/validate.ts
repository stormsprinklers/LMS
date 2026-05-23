import type { Invite } from "@prisma/client";

export function isInviteActive(invite: Invite): boolean {
  if (invite.expiresAt < new Date()) return false;
  if (invite.openSignup) {
    if (invite.usedAt) return false;
    if (invite.maxUses != null && invite.useCount >= invite.maxUses) return false;
    return true;
  }
  return !invite.usedAt;
}

export function inviteStatusLabel(invite: Invite): string {
  if (invite.expiresAt < new Date()) return "Expired";
  if (invite.openSignup) {
    if (invite.usedAt) return "Revoked";
    if (invite.maxUses != null && invite.useCount >= invite.maxUses) return "Limit reached";
    return "Active";
  }
  if (invite.usedAt) return "Used";
  return "Pending";
}
