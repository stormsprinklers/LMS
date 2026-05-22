import { execSync } from "node:child_process";

execSync("npx prisma generate", { stdio: "inherit" });

if (!process.env.DATABASE_URL) {
  console.error(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  BUILD FAILED: DATABASE_URL is not set on Vercel

  1. Open Vercel → your LMS project → Settings → Environment Variables
  2. Add DATABASE_URL (paste your Neon PostgreSQL connection string)
  3. Enable for: Production, Preview, and Development
  4. Redeploy

  Also add: AUTH_SECRET, NEXTAUTH_URL=https://learning.stormsprinklers.com
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
  process.exit(1);
}

// Migrations are not run during Vercel builds by default. Prisma migrate deploy
// uses a Postgres advisory lock that often times out on Neon (P1002), especially
// with concurrent deploys — without changing anything in Neon.
//
// When you add new prisma/migrations/* files, apply them once from your machine:
//   npm run db:migrate:deploy
// (uses DATABASE_URL from .env — same string as on Vercel.)
//
// Opt-in to run migrate on a single deploy: set RUN_PRISMA_MIGRATE=1 on Vercel.
if (process.env.RUN_PRISMA_MIGRATE === "1") {
  console.log("RUN_PRISMA_MIGRATE=1 — running prisma migrate deploy…");
  try {
    execSync("npx prisma migrate deploy", { stdio: "inherit" });
  } catch (err) {
    console.error(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  prisma migrate deploy failed. Unset RUN_PRISMA_MIGRATE on Vercel and redeploy
  (builds skip migrations by default). Apply migrations locally instead:
    npm run db:migrate:deploy
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
    throw err;
  }
} else {
  console.log(
    "Skipping prisma migrate deploy on build (avoids Neon advisory-lock timeouts).",
  );
  console.log(
    "After new migrations are added, run once locally: npm run db:migrate:deploy",
  );
}

console.log("Backfilling course builder curriculum from legacy lessons…");
try {
  execSync("npx tsx prisma/migrate-courses-to-builder.ts", { stdio: "inherit" });
} catch (e) {
  console.warn("Course builder backfill skipped or partial:", e.message ?? e);
}

console.log("Running production seed (skipped if admin already exists)…");
execSync("npx tsx prisma/seed-production.ts", { stdio: "inherit" });

console.log("Running next build…");
execSync("npx next build", { stdio: "inherit" });
