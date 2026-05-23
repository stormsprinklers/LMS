import { PageHeader } from "@/components/ui/PageHeader";
import { AdminArchivedLink } from "@/components/admin/AdminArchivedLink";
import { requireAdmin } from "@/lib/auth-utils";
import { listInvites, listUsers } from "@/lib/actions/invites";
import { isPrismaMissingColumn } from "@/lib/db/prisma-errors";
import type { UserRole } from "@prisma/client";
import { DeleteUserButton } from "./DeleteUserButton";
import { InviteForm } from "./InviteForm";
import { OpenSignupLinkForm } from "./OpenSignupLinkForm";
import { OpenSignupLinksList } from "./OpenSignupLinksList";
import { PendingMigrationBanner } from "./PendingMigrationBanner";
import { UserRoleSelect } from "./UserRoleSelect";

export const metadata = { title: "Admin — Users" };

export default async function AdminUsersPage() {
  const session = await requireAdmin();
  const users = await listUsers();
  const activeUsers = users.filter((u) => !u.archived);

  let invites: Awaited<ReturnType<typeof listInvites>> = [];
  let invitesSchemaReady = true;

  try {
    invites = await listInvites();
  } catch (error) {
    if (isPrismaMissingColumn(error, "Invite.openSignup")) {
      invitesSchemaReady = false;
    } else {
      throw error;
    }
  }

  const emailInvites = invites.filter((i) => !i.openSignup);
  const openLinks = invites.filter((i) => i.openSignup);

  return (
    <>
      <PageHeader
        title="Users & invites"
        description="Invite by email or share an open signup link for self-registration."
        action={<AdminArchivedLink />}
      />
      {!invitesSchemaReady && (
        <div className="mb-6">
          <PendingMigrationBanner />
        </div>
      )}
      {invitesSchemaReady && (
        <>
          <div className="space-y-6">
            <OpenSignupLinkForm />
            <div>
              <h3 className="mb-2 font-medium text-storm-navy">Email invite</h3>
              <p className="mb-3 text-sm text-storm-navy/60">
                One-time link for a specific email address.
              </p>
              <InviteForm />
            </div>
          </div>
          <OpenSignupLinksList links={openLinks} />
        </>
      )}
      <section className="mt-8">
        <h2 className="font-title text-lg font-bold text-storm-navy">Users</h2>
        <ul className="mt-3 space-y-3">
          {activeUsers.map((u) => (
            <li
              key={u.id}
              className="rounded-xl border border-storm-light-blue/60 bg-white p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="font-title font-bold text-storm-navy">
                    {u.name ?? u.email}
                  </p>
                  <p className="mt-1 text-sm text-storm-navy/60">
                    {u.email} · {u.status}
                  </p>
                </div>
                <div className="flex flex-col items-stretch gap-3 sm:items-end">
                  <UserRoleSelect
                    userId={u.id}
                    currentRole={u.role as UserRole}
                    isSelf={u.id === session.user.id}
                  />
                  <DeleteUserButton
                    userId={u.id}
                    email={u.email}
                    displayName={u.name ?? u.email}
                    disabled={u.id === session.user.id}
                    disabledReason={
                      u.id === session.user.id
                        ? "You cannot delete your own account"
                        : undefined
                    }
                  />
                </div>
              </div>
            </li>
          ))}
          {activeUsers.length === 0 && (
            <p className="text-sm text-storm-navy/60">No active users.</p>
          )}
        </ul>
      </section>
      {invitesSchemaReady && (
        <section className="mt-8">
          <h2 className="font-title text-lg font-bold text-storm-navy">
            Pending email invites
          </h2>
          <ul className="mt-3 space-y-2">
            {emailInvites
              .filter((i) => !i.usedAt)
              .map((i) => (
                <li key={i.id} className="rounded-lg border bg-white px-4 py-2 text-sm">
                  {i.email} · expires {i.expiresAt.toLocaleDateString()}
                  <br />
                  <code className="text-xs text-storm-medium-blue">/invite/{i.token}</code>
                </li>
              ))}
          </ul>
        </section>
      )}
    </>
  );
}
