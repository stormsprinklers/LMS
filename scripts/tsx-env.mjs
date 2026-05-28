import { config } from "dotenv";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
config({ path: join(root, ".env.local") });
config({ path: join(root, ".env") });

const script = process.argv[2];
if (!script) {
  console.error("Usage: node scripts/tsx-env.mjs <path-to-script.ts>");
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error(`
DATABASE_URL is not set.

1. Copy .env.example to .env.local in the project root
2. Paste your Neon connection string as DATABASE_URL
3. Run the command again
`);
  process.exit(1);
}

const result = spawnSync("npx", ["tsx", script, ...process.argv.slice(3)], {
  stdio: "inherit",
  env: process.env,
  shell: true,
  cwd: root,
});

process.exit(result.status ?? 1);
