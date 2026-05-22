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

console.log("Running prisma migrate deploy…");
execSync("npx prisma migrate deploy", { stdio: "inherit" });

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
