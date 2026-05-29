-- Repair drift: ensure LibraryAsset columns exist even if an earlier migration
-- was marked applied without running (e.g. partial deploy or wrong DATABASE_URL).

ALTER TABLE "LibraryAsset" ADD COLUMN IF NOT EXISTS "fileSizeBytes" INTEGER;
ALTER TABLE "LibraryAsset" ADD COLUMN IF NOT EXISTS "sourceCourseId" TEXT;
ALTER TABLE "LibraryAsset" ADD COLUMN IF NOT EXISTS "sourceCourseItemId" TEXT;

CREATE INDEX IF NOT EXISTS "LibraryAsset_sourceCourseItemId_idx" ON "LibraryAsset"("sourceCourseItemId");
CREATE INDEX IF NOT EXISTS "LibraryAsset_sourceCourseId_idx" ON "LibraryAsset"("sourceCourseId");

ALTER TABLE "LibraryAsset" ALTER COLUMN "scope" SET DEFAULT 'shared';
