import { PageHeader } from "@/components/ui/PageHeader";
import { listInvites, listUsers } from "@/lib/actions/invites";
import { InviteForm } from "./InviteForm";

export const metadata = { title: "Admin — Users" };

export default async function AdminUsersPage() {
  const [users, invites] = await Promise.all([listUsers(), listInvites()]);

  return (
    <>
      <PageHeader
        title="Users & invites"
        description="Invite employees by email. Share the invite link with them."
      />
      <InviteForm />
      <section className="mt-8">
        <h2 className="font-title text-lg font-bold text-storm-navy">Users</h2>
        <ul className="mt-3 space-y-2">
          {users.map((u) => (
            <li key={u.id} className="rounded-lg border bg-white px-4 py-2 text-sm">
              {u.name ?? "—"} · {u.email} · {u.role} · {u.status}
            </li>
          ))}
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
                <code className="text-xs text-storm-medium-blue">
                  /invite/{i.token}
                </code>
              </li>
            ))}
        </ul>
      </section>
    </>
  );
}
