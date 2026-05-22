# Vercel deployment — fixing `404: NOT_FOUND`

The error `404: NOT_FOUND` with an ID like `sfo1::...` is **Vercel’s platform**, not your Next.js app. It means Vercel has **no successful deployment** for that hostname yet.

## Checklist

1. **Vercel project** — Import `stormsprinklers/LMS` from GitHub. Root directory: `.` (repository root).

2. **Environment variables** — Project → **Settings → Environment Variables**:

   | Variable | Example / notes |
   |----------|-----------------|
   | `DATABASE_URL` | Neon connection string (`postgresql://...?sslmode=require`) |
   | `AUTH_SECRET` | Random string (`openssl rand -base64 32`) |
   | `NEXTAUTH_URL` | `https://learning.stormsprinklers.com` |

   Enable each for **Production**, **Preview**, and **Development** so they are available at **build time** (required for `prisma migrate deploy`).

   Optional: `MUX_TOKEN_ID`, `MUX_TOKEN_SECRET`, `MUX_WEBHOOK_SECRET`, `BLOB_READ_WRITE_TOKEN`

   **If the build log shows `Environment variable not found: DATABASE_URL`**, the deploy never completed — add `DATABASE_URL` and redeploy.

3. **Build succeeds** — Deployments tab → latest deployment must be **Ready**, not Error or Canceled. Open build logs if it failed (often missing `DATABASE_URL` or failed `prisma migrate deploy`).

4. **Domain** — Project → Settings → Domains → `learning.stormsprinklers.com` must show **Valid** and be assigned to **this** project.

5. **DNS** — At your DNS host, add the record Vercel shows (usually CNAME `learning` → `cname.vercel-dns.com`).

6. **Redeploy** — After env vars are set: Deployments → Redeploy production.

## Admin account (automatic on Vercel)

On each deploy, the build runs `prisma/seed-production.ts` after migrations. It **only runs when no admin exists** — safe to redeploy without wiping data.

Default login (if you do not set custom env vars):

- Email: `admin@stormsprinklers.com`
- Password: `admin123!`

**Recommended on Vercel** — add:

| Variable | Purpose |
|----------|---------|
| `ADMIN_EMAIL` | Admin login email (optional, default above) |
| `ADMIN_INITIAL_PASSWORD` | Strong password set on first deploy |

After the first successful deploy with users in the DB, change the password via Admin → Users or update the user in Neon.

`npm run db:seed` is only for **local development** (resets the database).

## Webhook URL for Mux

`https://learning.stormsprinklers.com/api/webhooks/mux`
