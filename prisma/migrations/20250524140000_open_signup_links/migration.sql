-- Open signup links: reusable invite URLs not tied to a specific email
ALTER TABLE "Invite" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "Invite" ADD COLUMN "openSignup" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Invite" ADD COLUMN "label" TEXT;
ALTER TABLE "Invite" ADD COLUMN "maxUses" INTEGER;
ALTER TABLE "Invite" ADD COLUMN "useCount" INTEGER NOT NULL DEFAULT 0;
