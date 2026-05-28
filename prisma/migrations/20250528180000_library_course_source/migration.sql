-- AlterTable
ALTER TABLE "LibraryAsset" ADD COLUMN "sourceCourseId" TEXT;
ALTER TABLE "LibraryAsset" ADD COLUMN "sourceCourseItemId" TEXT;

-- CreateIndex
CREATE INDEX "LibraryAsset_sourceCourseItemId_idx" ON "LibraryAsset"("sourceCourseItemId");
CREATE INDEX "LibraryAsset_sourceCourseId_idx" ON "LibraryAsset"("sourceCourseId");
