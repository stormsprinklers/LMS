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

console.log("Running next build…");
execSync("npx next build", { stdio: "inherit" });
