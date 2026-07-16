-- AlterTable
ALTER TABLE "CertificationRule" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "CertificationRule" ADD COLUMN IF NOT EXISTS "badgeUrl" TEXT;
ALTER TABLE "CertificationRule" ADD COLUMN IF NOT EXISTS "enabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Certification" ADD COLUMN IF NOT EXISTS "pdfUrl" TEXT;
ALTER TABLE "Certification" ADD COLUMN IF NOT EXISTS "badgeUrl" TEXT;
ALTER TABLE "Certification" ADD COLUMN IF NOT EXISTS "emailedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CertificationPrerequisite" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "requiredCourseId" TEXT NOT NULL,

    CONSTRAINT "CertificationPrerequisite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CertificationPrerequisite_ruleId_requiredCourseId_key" ON "CertificationPrerequisite"("ruleId", "requiredCourseId");
CREATE INDEX IF NOT EXISTS "CertificationPrerequisite_requiredCourseId_idx" ON "CertificationPrerequisite"("requiredCourseId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CertificationPrerequisite" ADD CONSTRAINT "CertificationPrerequisite_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "CertificationRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CertificationPrerequisite" ADD CONSTRAINT "CertificationPrerequisite_requiredCourseId_fkey" FOREIGN KEY ("requiredCourseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
