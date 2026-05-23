import { Card } from "@/components/ui/Card";

export function PendingMigrationBanner() {
  return (
    <Card className="border-amber-300 bg-amber-50">
      <h3 className="font-medium text-amber-950">Database update required</h3>
      <p className="mt-2 text-sm text-amber-900">
        Invites and open signup links need a one-time schema update on your production
        database. User listing works; invite features stay disabled until this is applied.
      </p>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-amber-900">
        <li>
          Copy <code className="text-xs">DATABASE_URL</code> from Vercel → Settings →
          Environment Variables into a local <code className="text-xs">.env.local</code>{" "}
          file.
        </li>
        <li>
          Run{" "}
          <code className="text-xs">npm run db:migrate:deploy</code> from the project root.
        </li>
        <li>Reload this page.</li>
      </ol>
      <p className="mt-3 text-xs text-amber-800">
        Alternative: run <code className="text-xs">scripts/fix-production-schema.sql</code>{" "}
        in the Neon SQL Editor, then{" "}
        <code className="text-xs">npx prisma migrate resolve --applied …</code> for each
        pending migration (see file comments).
      </p>
    </Card>
  );
}
