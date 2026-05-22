# Vercel deployment — fixing `404: NOT_FOUND`

The error `404: NOT_FOUND` with an ID like `sfo1::...` is **Vercel’s platform**, not your Next.js app. It means Vercel has **no successful deployment** for that hostname yet.

## Checklist

1. **Vercel project** — Import `stormsprinklers/LMS` from GitHub. Root directory: `.` (repository root).

2. **Environment variables** (Production + Preview):
   - `DATABASE_URL`
   - `AUTH_SECRET`
   - `NEXTAUTH_URL` = `https://learning.stormsprinklers.com`
   - Optional: `MUX_*`, `BLOB_READ_WRITE_TOKEN`

3. **Build succeeds** — Deployments tab → latest deployment must be **Ready**, not Error or Canceled. Open build logs if it failed (often missing `DATABASE_URL` or failed `prisma migrate deploy`).

4. **Domain** — Project → Settings → Domains → `learning.stormsprinklers.com` must show **Valid** and be assigned to **this** project.

5. **DNS** — At your DNS host, add the record Vercel shows (usually CNAME `learning` → `cname.vercel-dns.com`).

6. **Redeploy** — After env vars are set: Deployments → Redeploy production.

## After first deploy

```bash
# One-time: seed demo users (run locally with production DATABASE_URL or use Vercel CLI)
npm run db:seed
```

## Webhook URL for Mux

`https://learning.stormsprinklers.com/api/webhooks/mux`
