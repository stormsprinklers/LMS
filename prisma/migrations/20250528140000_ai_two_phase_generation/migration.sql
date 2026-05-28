ALTER TYPE "AiSessionStatus" ADD VALUE IF NOT EXISTS 'structure_ready';
ALTER TYPE "AiSessionStatus" ADD VALUE IF NOT EXISTS 'generating_content';

ALTER TABLE "AiGenerationSession" ADD COLUMN IF NOT EXISTS "generationMessages" JSONB;
ALTER TABLE "AiGenerationSession" ADD COLUMN IF NOT EXISTS "contentItemCursor" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AiGenerationSession" ADD COLUMN IF NOT EXISTS "structureApproved" BOOLEAN NOT NULL DEFAULT false;
