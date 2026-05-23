-- Apply pending schema changes when prisma migrate deploy cannot be run yet.
-- Prefer: npm run db:migrate:deploy (with production DATABASE_URL in .env.local)
--
-- After running this in Neon SQL Editor, mark migrations as applied so deploy stays in sync:
--   npx prisma migrate resolve --applied 20250524140000_open_signup_links
--   npx prisma migrate resolve --applied 20250524150000_manager_role

ALTER TABLE "Invite" ALTER COLUMN "email" DROP NOT NULL;

ALTER TABLE "Invite" ADD COLUMN IF NOT EXISTS "openSignup" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Invite" ADD COLUMN IF NOT EXISTS "label" TEXT;
ALTER TABLE "Invite" ADD COLUMN IF NOT EXISTS "maxUses" INTEGER;
ALTER TABLE "Invite" ADD COLUMN IF NOT EXISTS "useCount" INTEGER NOT NULL DEFAULT 0;

ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'MANAGER';
