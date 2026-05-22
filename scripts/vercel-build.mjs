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

/**
 * Prisma migrate uses PostgreSQL advisory locks. Neon's *pooler* URL cannot
 * acquire them (P1002 timeout). Use a direct (non-pooler) connection for migrations.
 */
function resolveMigrationDatabaseUrl() {
  if (process.env.DIRECT_DATABASE_URL) {
    return process.env.DIRECT_DATABASE_URL;
  }
  const pooled = process.env.DATABASE_URL;
  if (pooled.includes("-pooler.")) {
    const direct = pooled.replace("-pooler.", ".");
    console.log(
      "Migrations: using direct Neon host (derived from DATABASE_URL by removing -pooler).",
    );
    console.log(
      "Recommended: set DIRECT_DATABASE_URL in Vercel to Neon’s explicit direct connection string.",
    );
    return direct;
  }
  return pooled;
}

function sleep(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    /* spin */
  }
}

function runWithMigrationDb(command) {
  const migrationUrl = resolveMigrationDatabaseUrl();
  const env = { ...process.env, DATABASE_URL: migrationUrl };
  execSync(command, { stdio: "inherit", env });
}

function migrateDeployWithRetry(maxAttempts = 4) {
  const migrationUrl = resolveMigrationDatabaseUrl();
  const env = { ...process.env, DATABASE_URL: migrationUrl };

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(
        `Running prisma migrate deploy… (attempt ${attempt}/${maxAttempts})`,
      );
      execSync("npx prisma migrate deploy", { stdio: "inherit", env });
      return;
    } catch (err) {
      const isLast = attempt === maxAttempts;
      const message = err?.message ?? String(err);
      const lockTimeout =
        message.includes("advisory lock") || message.includes("P1002");

      if (isLast) {
        console.error(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  BUILD FAILED: prisma migrate deploy

  Common fixes on Neon + Vercel:
  1. Add DIRECT_DATABASE_URL — Neon dashboard → Connection details →
     "Direct connection" (NOT the pooler URL). Enable for Production + Preview.
  2. Ensure DATABASE_URL uses the pooler for the running app; migrations need direct.
  3. If a previous deploy was interrupted, wait 1–2 minutes and redeploy
     (stale advisory lock). Avoid multiple simultaneous production deploys.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
        throw err;
      }

      const waitSec = lockTimeout ? 15 : 8;
      console.warn(
        `migrate deploy failed (attempt ${attempt}/${maxAttempts}), retrying in ${waitSec}s…`,
      );
      sleep(waitSec * 1000);
    }
  }
}

migrateDeployWithRetry();

console.log("Backfilling course builder curriculum from legacy lessons…");
try {
  runWithMigrationDb("npx tsx prisma/migrate-courses-to-builder.ts");
} catch (e) {
  console.warn("Course builder backfill skipped or partial:", e.message ?? e);
}

console.log("Running production seed (skipped if admin already exists)…");
runWithMigrationDb("npx tsx prisma/seed-production.ts");

console.log("Running next build…");
execSync("npx next build", { stdio: "inherit" });
