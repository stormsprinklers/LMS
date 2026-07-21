<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

### Stack

Single **Next.js 16** app (`storm-lms`) at repo root with **PostgreSQL** (Prisma) and **Auth.js** credentials login. Package manager: **npm** (`package-lock.json`). See `README.md` for demo accounts after seed.

### PostgreSQL (Cloud VM)

The repo does not ship Docker Compose. On a fresh Ubuntu VM, install and start Postgres once (outside the update script):

```bash
sudo apt-get install -y postgresql postgresql-client
sudo pg_ctlcluster 16 main start
```

Example local database (adjust credentials as needed):

```bash
sudo -u postgres psql -c "CREATE USER storm_lms WITH PASSWORD 'storm_lms_dev' CREATEDB;"
sudo -u postgres psql -c "CREATE DATABASE storm_lms OWNER storm_lms;"
```

Copy `.env.example` → `.env.local` with at least `DATABASE_URL`, `AUTH_SECRET`, and `NEXTAUTH_URL=http://localhost:3000`.

### Database commands

- Prefer **`npm run db:migrate:deploy`** for non-interactive migrations (avoids `prisma migrate dev` prompts and advisory-lock issues if a prior migrate was interrupted).
- **`npm run db:seed`** resets and seeds demo data (admin `admin@stormsprinklers.com` / `admin123!`).
- If migrate hangs on advisory lock: terminate other sessions on `storm_lms` via `pg_terminate_backend` (see Prisma P1002 docs).

### Running the app

```bash
npm run dev    # http://localhost:3000
```

Use **tmux** for long-running dev servers in Cloud Agent VMs.

### Admin course routes (Next.js 16)

Under `src/app/(dashboard)/admin/courses/`, dynamic segments must share one param name. The app uses both UUIDs (`…/courses/<id>/builder`) and slugs (`…/courses/<slug>/admins`). These live under a single `[courseId]` folder; slug-based URLs pass the slug as the `courseId` param (see redirect page at `[courseId]/page.tsx`).

### Lint / tests

- **`npm run lint`** — may report existing violations; **`npm run build`** is the stronger compile check.
- No `npm test` script in `package.json`.

### Optional integrations

`BLOB_READ_WRITE_TOKEN`, Mux, OpenAI, and Google keys in `.env.example` are optional for basic login, courses list, and admin UI. Required for Library uploads, video pipeline, and AI Studio.
