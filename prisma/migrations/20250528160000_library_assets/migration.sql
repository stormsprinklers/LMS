-- CreateEnum
CREATE TYPE "LibraryAssetScope" AS ENUM ('personal', 'shared');

-- CreateTable
CREATE TABLE "LibraryAsset" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "scope" "LibraryAssetScope" NOT NULL DEFAULT 'personal',
    "createdById" TEXT NOT NULL,
    "kind" "AiSourceAssetKind" NOT NULL,
    "filename" TEXT,
    "mimeType" TEXT,
    "blobUrl" TEXT,
    "includeRecording" BOOLEAN NOT NULL DEFAULT true,
    "extractedText" TEXT,
    "transcript" TEXT,
    "summary" TEXT,
    "durationSeconds" INTEGER,
    "muxAssetId" TEXT,
    "muxPlaybackId" TEXT,
    "processingStatus" "AiAssetProcessingStatus" NOT NULL DEFAULT 'pending',
    "processingError" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LibraryAsset_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "AiSourceAsset" ADD COLUMN "libraryAssetId" TEXT;

-- CreateIndex
CREATE INDEX "LibraryAsset_createdById_idx" ON "LibraryAsset"("createdById");

-- CreateIndex
CREATE INDEX "LibraryAsset_scope_archived_idx" ON "LibraryAsset"("scope", "archived");

-- AddForeignKey
ALTER TABLE "LibraryAsset" ADD CONSTRAINT "LibraryAsset_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
