import { config } from "dotenv";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import {
  bootstrapDatabase,
  DEFAULT_ADMIN_EMAIL,
} from "./seed-bootstrap";

config({ path: join(process.cwd(), ".env.local") });
config({ path: join(process.cwd(), ".env") });

if (!process.env.DATABASE_URL) {
  console.error(`
DATABASE_URL is not set.

Copy .env.example to .env.local and add your Neon connection string, then run:
  npm run db:seed:production
`);
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL ?? DEFAULT_ADMIN_EMAIL;

  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (existingAdmin) {
    console.log(
      `Production seed skipped — admin already exists (${adminEmail}).`,
    );
    return;
  }

  const { adminEmail: email } = await bootstrapDatabase(prisma);

  console.log("Production bootstrap complete.");
  console.log(`Admin login: ${email}`);
  if (!process.env.ADMIN_INITIAL_PASSWORD) {
    console.log(
      "Default password: admin123! — set ADMIN_INITIAL_PASSWORD on Vercel and redeploy to use a custom password.",
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
