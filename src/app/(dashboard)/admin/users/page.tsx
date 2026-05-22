import { PageHeader } from "@/components/ui/PageHeader";
import { AdminArchivedLink } from "@/components/admin/AdminArchivedLink";
import { AdminListCard } from "@/components/admin/AdminListCard";
import { listInvites, listUsers } from "@/lib/actions/invites";
import { InviteForm } from "./InviteForm";

export const metadata = { title: "Admin — Users" };

export default async function AdminUsersPage() {
  const [users, invites] = await Promise.all([listUsers(), listInvites()]);
  const activeUsers = users.filter((u) => !u.archived);

  return (
    <>
      <PageHeader
        title="Users & invites"
        description="Invite employees by email. Archive users to disable access without deleting history."
        action={<AdminArchivedLink />}
      />
      <InviteForm />
      <section className="mt-8">
        <h2 className="font-title text-lg font-bold text-storm-navy">Users</h2>
        <ul className="mt-3 space-y-3">
          {activeUsers.map((u) => (
            <AdminListCard
              key={u.id}
              title={u.name ?? u.email}
              subtitle={`${u.email} · ${u.role} · ${u.status}`}
              type="user"
              id={u.id}
            />
          ))}
          {activeUsers.length === 0 && (
            <p className="text-sm text-storm-navy/60">No active users.</p>
          )}
        </ul>
      </section>
      <section className="mt-8">
        <h2 className="font-title text-lg font-bold text-storm-navy">Pending invites</h2>
        <ul className="mt-3 space-y-2">
          {invites
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
    </>
  );
}
