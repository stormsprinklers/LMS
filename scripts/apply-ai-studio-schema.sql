-- Run in Neon SQL Editor if production logs: table "AiGenerationSession" does not exist
-- Then mark migrations applied from your machine:
--   npm run db:migrate:deploy
-- (uses DATABASE_URL from .env.local pointing at the same Neon database)

-- Base AI tables (from prisma/migrations/20250528120000_ai_course_builder)
DO $$ BEGIN
  CREATE TYPE "AiGenerationMode" AS ENUM ('course', 'module', 'lesson');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AiSessionStatus" AS ENUM ('collecting', 'processing', 'generating', 'ready', 'applied', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AiSourceAssetKind" AS ENUM ('pdf', 'pptx', 'text', 'audio', 'video', 'image', 'embed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AiAssetProcessingStatus" AS ENUM ('pending', 'processing', 'ready', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "AiGenerationSession" (
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

CREATE TABLE IF NOT EXISTS "AiSourceAsset" (
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

CREATE INDEX IF NOT EXISTS "AiSourceAsset_sessionId_idx" ON "AiSourceAsset"("sessionId");

DO $$ BEGIN
  ALTER TABLE "AiGenerationSession" ADD CONSTRAINT "AiGenerationSession_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AiGenerationSession" ADD CONSTRAINT "AiGenerationSession_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AiSourceAsset" ADD CONSTRAINT "AiSourceAsset_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "AiGenerationSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Later AI migrations
ALTER TYPE "AiSourceAssetKind" ADD VALUE IF NOT EXISTS 'webpage';
ALTER TYPE "AiSessionStatus" ADD VALUE IF NOT EXISTS 'structure_ready';
ALTER TYPE "AiSessionStatus" ADD VALUE IF NOT EXISTS 'generating_content';

ALTER TABLE "AiGenerationSession" ADD COLUMN IF NOT EXISTS "generationMessages" JSONB;
ALTER TABLE "AiGenerationSession" ADD COLUMN IF NOT EXISTS "contentItemCursor" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AiGenerationSession" ADD COLUMN IF NOT EXISTS "structureApproved" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AiGenerationSession" ADD COLUMN IF NOT EXISTS "allowedItemTypes" JSONB NOT NULL DEFAULT '["LESSON","VIDEO","QUIZ","EXAM","SCENARIO","SKILL_CHECK"]';
