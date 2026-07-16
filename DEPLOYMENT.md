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
   | `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | Base64 AES key (32 bytes) — keeps Server Action IDs stable across deploys. Generate: `openssl rand -base64 32`. Set on **Production, Preview, and Development** so every build uses the same key. |

   Enable each for **Production**, **Preview**, and **Development** so they are available at **build time**.

   **If Library or AI Studio fails** with missing table errors (`LibraryAsset`, `AiGenerationSession`), production is behind migrations. From your machine (same `DATABASE_URL` as Vercel):


   ```bash
   npm run db:migrate:deploy
   ```

   Or run [`scripts/apply-ai-studio-schema.sql`](scripts/apply-ai-studio-schema.sql) in the Neon SQL Editor, then `npm run db:migrate:deploy` to sync migration history.

   **If Admin → Users shows “Database update required”** or logs `Invite.openSignup does not exist`, production is behind the Prisma schema. From your machine:

   ```bash
   # .env.local with the same DATABASE_URL as Vercel (Neon)
   npm run db:migrate:deploy
   ```

   Or run `scripts/fix-production-schema.sql` in the Neon SQL Editor, then mark migrations applied with `npx prisma migrate resolve --applied <migration_name>` (see comments in that file).

   **If CRM → LMS employee sync returns 500 / “Failed to sync user”**, production is missing
   `User.crmUserId` (and related) columns. From your machine:

   ```bash
   npm run db:migrate:deploy
   ```

   Or run the CRM sync section at the bottom of [`scripts/fix-production-schema.sql`](scripts/fix-production-schema.sql) in the Neon SQL Editor, then:

   ```bash
   npx prisma migrate resolve --applied 20250716000000_crm_user_sync_fields
   ```

   **Database migrations:** Vercel builds **do not** run `prisma migrate deploy` (avoids Neon advisory-lock timeouts). Your existing Neon database is unchanged until you run the command above. When you add new files under `prisma/migrations/`, apply them once from your computer:

   ```bash
   # .env.local with the same DATABASE_URL as production
   npm run db:migrate:deploy
   ```

   Then redeploy on Vercel. Optional: set `RUN_PRISMA_MIGRATE=1` on Vercel only if you intentionally want migrations during a build (not recommended on Neon).

   Optional: `MUX_TOKEN_ID`, `MUX_TOKEN_SECRET`, `MUX_WEBHOOK_SECRET`, `OPENAI_API_KEY` (AI Studio in course builder)

   **If uploads fail with “Server Action … was not found”** after a deploy, hard-refresh the page (Ctrl+Shift+R). Ensure `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` is set on Vercel (see table above) and redeploy. Library uploads use `/api/library/*` routes and do not depend on Server Actions for the save step.

   **Required for file uploads (Library, AI Studio, PDF manuals):** `BLOB_READ_WRITE_TOKEN` — see [Vercel Blob setup](#vercel-blob-file-uploads) below.

   **If the build log shows `Environment variable not found: DATABASE_URL`**, the deploy never completed — add `DATABASE_URL` and redeploy.

3. **Build succeeds** — Deployments tab → latest deployment must be **Ready**, not Error or Canceled. Open build logs if it failed (often missing `DATABASE_URL` or failed `prisma migrate deploy`).

4. **Domain** — Project → Settings → Domains → `learning.stormsprinklers.com` must show **Valid** and be assigned to **this** project.

5. **DNS** — At your DNS host, add the record Vercel shows (usually CNAME `learning` → `cname.vercel-dns.com`).

6. **Redeploy** — After env vars are set: Deployments → Redeploy production.

## Admin account (first-time setup)

Vercel builds **do not** run database seed/backfill by default (Neon is often unreachable during build). After pointing `.env.local` at production `DATABASE_URL`, run once from your machine:

```bash
npm run db:migrate:deploy
npm run db:seed:production
```

`seed-production.ts` **only creates an admin when none exists** — safe to run again.

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

## Vercel Blob (file uploads)

Library uploads, AI Studio source files, and admin PDF manuals are stored in **Vercel Blob**. Without it you will see errors like *“Failed to retrieve the client token”* or *“File storage is not configured”*.

### Production (Vercel dashboard)

1. Open [vercel.com](https://vercel.com) → your **LMS** project.
2. Go to **Storage** tab → **Create Database** → choose **Blob**.
3. Name the store (e.g. `storm-lms-files`) and create it.
4. When prompted, **Connect to Project** and select your LMS project (Production + Preview).
5. Vercel adds `BLOB_READ_WRITE_TOKEN` to the project automatically.
6. **Redeploy** production (Deployments → … → Redeploy) so the running app picks up the new variable.

### Local development

1. In Vercel → Project → **Settings** → **Environment Variables**, copy the value of `BLOB_READ_WRITE_TOKEN` (or use the Storage → your blob store → **.env.local** snippet).
2. Paste into `.env.local` in the repo root:
   ```
   BLOB_READ_WRITE_TOKEN="vercel_blob_rw_..."
   ```
3. Restart `npm run dev`.

Alternatively, from the project folder with the Vercel CLI linked to the project:

```bash
vercel env pull .env.local
```

### Verify

After setup, upload a small PDF in **Library**. It should appear in the list without token errors. In Vercel → Storage → your blob store, you should see objects under `library/`.

## Webhook URL for Mux

`https://learning.stormsprinklers.com/api/webhooks/mux`
