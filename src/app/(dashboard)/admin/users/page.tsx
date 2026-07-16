import { PageHeader } from "@/components/ui/PageHeader";
import { AdminArchivedLink } from "@/components/admin/AdminArchivedLink";
import { requireAdmin } from "@/lib/auth-utils";
import { listUsers } from "@/lib/actions/invites";
import type { UserRole } from "@prisma/client";
import { UserAccountActions } from "./UserAccountActions";
import { UserRoleSelect } from "./UserRoleSelect";

export const metadata = { title: "Admin — Users" };

export default async function AdminUsersPage() {
  const session = await requireAdmin();
  const users = await listUsers();
  const activeUsers = users.filter((u) => !u.archived);

  return (
    <>
      <PageHeader
        title="Users"
        description="LMS accounts are created and updated from CRM employees. Sign-in uses CRM password + SMS 2FA."
        action={<AdminArchivedLink />}
      />
      <section className="rounded-xl border border-storm-light-blue/60 bg-sky-50/60 p-4 text-sm text-storm-navy">
        <p className="font-medium">Managed from CRM</p>
        <p className="mt-1 text-storm-navy/70">
          Add or edit people under CRM → Settings → Employees, then use{" "}
          <strong>Sync employees to LMS</strong> on CRM Integrations (or save the employee)
          to push changes here. Prefer <strong>Archive</strong> over delete when someone has
          training history.
        </p>
      </section>
      <section className="mt-8">
        <h2 className="font-title text-lg font-bold text-storm-navy">Active users</h2>
        <ul className="mt-3 space-y-3">
          {activeUsers.map((u) => (
            <li
              key={u.id}
              className="rounded-xl border border-storm-light-blue/60 bg-white p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  {u.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={u.photoUrl}
                      alt=""
                      className="h-12 w-12 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-storm-medium-blue/15 text-sm font-semibold text-storm-medium-blue">
                      {(u.name ?? u.email).slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                  <p className="font-title font-bold text-storm-navy">
                    {u.name ?? u.email}
                  </p>
                  <p className="mt-1 text-sm text-storm-navy/60">
                    {u.email} · {u.status}
                    {u.crmUserId ? " · Linked to CRM" : " · Not linked to CRM"}
                  </p>
                  {u.crmLastSyncedAt ? (
                    <p className="mt-0.5 text-xs text-storm-navy/50">
                      Last CRM sync {u.crmLastSyncedAt.toLocaleString()}
                      {u.crmSyncStatus ? ` (${u.crmSyncStatus})` : ""}
                    </p>
                  ) : null}
                  </div>
                </div>
                <div className="flex flex-col items-stretch gap-3 sm:items-end">
                  <UserRoleSelect
                    userId={u.id}
                    currentRole={u.role as UserRole}
                    isSelf={u.id === session.user.id}
                  />
                  <UserAccountActions
                    userId={u.id}
                    email={u.email}
                    displayName={u.name ?? u.email}
                    disabled={u.id === session.user.id}
                    disabledReason={
                      u.id === session.user.id
                        ? "You cannot archive or delete your own account"
                        : undefined
                    }
                  />
                </div>
              </div>
            </li>
          ))}
          {activeUsers.length === 0 && (
            <p className="text-sm text-storm-navy/60">
              No active users. Sync employees from the CRM to create them here.
            </p>
          )}
        </ul>
      </section>
    </>
  );
}
