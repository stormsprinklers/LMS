-- AI course builder sessions and source assets
CREATE TYPE "AiGenerationMode" AS ENUM ('course', 'module', 'lesson');
CREATE TYPE "AiSessionStatus" AS ENUM ('collecting', 'processing', 'generating', 'ready', 'applied', 'failed');
CREATE TYPE "AiSourceAssetKind" AS ENUM ('pdf', 'pptx', 'text', 'audio', 'video', 'image', 'embed');
CREATE TYPE "AiAssetProcessingStatus" AS ENUM ('pending', 'processing', 'ready', 'failed');

CREATE TABLE "AiGenerationSession" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "mode" "AiGenerationMode" NOT NULL,
    "targetModuleId" TEXT,
    "status" "AiSessionStatus" NOT NULL DEFAULT 'collecting',
    "userPrompt" TEXT,
    "blueprintJson" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiGenerationSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiSourceAsset" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "kind" "AiSourceAssetKind" NOT NULL,
    "filename" TEXT,
    "mimeType" TEXT,
    "blobUrl" TEXT,
    "placementHint" TEXT,
    "includeRecording" BOOLEAN NOT NULL DEFAULT true,
    "extractedText" TEXT,
    "transcript" TEXT,
    "summary" TEXT,
    "durationSeconds" INTEGER,
    "muxAssetId" TEXT,
    "muxPlaybackId" TEXT,
    "processingStatus" "AiAssetProcessingStatus" NOT NULL DEFAULT 'pending',
    "processingError" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiSourceAsset_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiSourceAsset_sessionId_idx" ON "AiSourceAsset"("sessionId");

ALTER TABLE "AiGenerationSession" ADD CONSTRAINT "AiGenerationSession_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiGenerationSession" ADD CONSTRAINT "AiGenerationSession_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiSourceAsset" ADD CONSTRAINT "AiSourceAsset_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AiGenerationSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
