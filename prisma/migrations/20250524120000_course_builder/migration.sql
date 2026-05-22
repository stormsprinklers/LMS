-- Course builder enums
CREATE TYPE "CourseStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "CourseDifficulty" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'READY', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "CourseItemType" AS ENUM ('LESSON', 'VIDEO', 'QUIZ', 'EXAM', 'SKILL_CHECK', 'SCENARIO');
CREATE TYPE "CourseItemTrack" AS ENUM ('LEARN', 'PRACTICE', 'PROVE');
CREATE TYPE "ModuleUnlockRule" AS ENUM ('ALWAYS', 'PREVIOUS_MODULE_COMPLETE', 'QUIZ_PASSED', 'MANUAL');
CREATE TYPE "CourseVisibility" AS ENUM ('PRIVATE', 'UNLISTED', 'PUBLIC');
CREATE TYPE "EnrollmentMode" AS ENUM ('MANUAL', 'AUTO', 'SELF_ENROLL');
CREATE TYPE "CourseDueDateType" AS ENUM ('NONE', 'RELATIVE', 'FIXED');
CREATE TYPE "AssignToType" AS ENUM ('USER', 'ROLE', 'ALL');
CREATE TYPE "SkillCheckPassingRule" AS ENUM ('ALL_REQUIRED', 'MINIMUM_SCORE');

-- Course extensions
ALTER TABLE "Course" ADD COLUMN "shortDescription" TEXT;
ALTER TABLE "Course" ADD COLUMN "estimatedMinutes" INTEGER;
ALTER TABLE "Course" ADD COLUMN "difficulty" "CourseDifficulty" NOT NULL DEFAULT 'BEGINNER';
ALTER TABLE "Course" ADD COLUMN "thumbnailUrl" TEXT;
ALTER TABLE "Course" ADD COLUMN "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Course" ADD COLUMN "internalNotes" TEXT;
ALTER TABLE "Course" ADD COLUMN "status" "CourseStatus" NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "Course" ADD COLUMN "hasUnpublishedChanges" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Course" ADD COLUMN "publishedAt" TIMESTAMP(3);
ALTER TABLE "Course" ADD COLUMN "createdById" TEXT;
ALTER TABLE "Course" ADD CONSTRAINT "Course_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Module extensions
ALTER TABLE "Module" ADD COLUMN "description" TEXT;
ALTER TABLE "Module" ADD COLUMN "estimatedMinutes" INTEGER;
ALTER TABLE "Module" ADD COLUMN "isRequired" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Module" ADD COLUMN "unlockRule" "ModuleUnlockRule" NOT NULL DEFAULT 'ALWAYS';
ALTER TABLE "Module" ADD COLUMN "status" "ContentStatus" NOT NULL DEFAULT 'PUBLISHED';

-- New tables
CREATE TABLE "LessonContent" (
    "id" TEXT NOT NULL,
    "bodyJson" JSONB,
    "bodyHtml" TEXT,
    "completionRule" TEXT NOT NULL DEFAULT 'viewed',
    "minimumTimeSeconds" INTEGER,
    CONSTRAINT "LessonContent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VideoLesson" (
    "id" TEXT NOT NULL,
    "videoUrl" TEXT,
    "muxAssetId" TEXT,
    "muxPlaybackId" TEXT,
    "durationSeconds" INTEGER,
    "transcript" TEXT,
    "requiredWatchPercent" INTEGER NOT NULL DEFAULT 80,
    "completionRule" TEXT NOT NULL DEFAULT 'watch_percent',
    "status" TEXT NOT NULL DEFAULT 'pending',
    CONSTRAINT "VideoLesson_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SkillCheck" (
    "id" TEXT NOT NULL,
    "traineeInstructions" TEXT,
    "evaluatorInstructions" TEXT,
    "passingRule" "SkillCheckPassingRule" NOT NULL DEFAULT 'ALL_REQUIRED',
    "minimumScore" INTEGER,
    "requiresEvaluator" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "SkillCheck_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SkillCheckStep" (
    "id" TEXT NOT NULL,
    "skillCheckId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "points" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "SkillCheckStep_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SkillCheckCompletion" (
    "id" TEXT NOT NULL,
    "skillCheckId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "score" INTEGER,
    "notes" TEXT,
    "evaluatedById" TEXT,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SkillCheckCompletion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Scenario" (
    "id" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "backgroundInfo" TEXT,
    "difficulty" TEXT,
    "category" TEXT,
    CONSTRAINT "Scenario_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CourseItem" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "itemType" "CourseItemType" NOT NULL,
    "title" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "estimatedMinutes" INTEGER,
    "completionRule" TEXT NOT NULL DEFAULT 'manual',
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "track" "CourseItemTrack" NOT NULL DEFAULT 'LEARN',
    "legacyLessonId" TEXT,
    "lessonContentId" TEXT,
    "videoLessonId" TEXT,
    "examId" TEXT,
    "skillCheckId" TEXT,
    "scenarioId" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CourseItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CourseSettings" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "visibility" "CourseVisibility" NOT NULL DEFAULT 'PRIVATE',
    "enrollmentMode" "EnrollmentMode" NOT NULL DEFAULT 'MANUAL',
    "dueDateType" "CourseDueDateType" NOT NULL DEFAULT 'NONE',
    "dueDaysAfterEnrollment" INTEGER,
    "fixedDueDate" TIMESTAMP(3),
    "requireAllLessons" BOOLEAN NOT NULL DEFAULT true,
    "requireAllQuizzes" BOOLEAN NOT NULL DEFAULT true,
    "requireAllSkillChecks" BOOLEAN NOT NULL DEFAULT true,
    "finalExamRequired" BOOLEAN NOT NULL DEFAULT false,
    "finalExamPassingScore" INTEGER,
    "issueCertificate" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnAssign" BOOLEAN NOT NULL DEFAULT true,
    "notifyReminder" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "CourseSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CourseEnrollmentAssignment" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "assignedById" TEXT,
    "assignToType" "AssignToType" NOT NULL,
    "assignToId" TEXT,
    "dueDateType" "CourseDueDateType" NOT NULL DEFAULT 'NONE',
    "dueDays" INTEGER,
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CourseEnrollmentAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CourseItemProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseItemId" TEXT NOT NULL,
    "status" "LessonProgressStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "watchedSeconds" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CourseItemProgress_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
CREATE UNIQUE INDEX "CourseItem_legacyLessonId_key" ON "CourseItem"("legacyLessonId");
CREATE UNIQUE INDEX "CourseItem_lessonContentId_key" ON "CourseItem"("lessonContentId");
CREATE UNIQUE INDEX "CourseItem_videoLessonId_key" ON "CourseItem"("videoLessonId");
CREATE UNIQUE INDEX "CourseItem_examId_key" ON "CourseItem"("examId");
CREATE UNIQUE INDEX "CourseItem_skillCheckId_key" ON "CourseItem"("skillCheckId");
CREATE UNIQUE INDEX "CourseItem_scenarioId_key" ON "CourseItem"("scenarioId");
CREATE UNIQUE INDEX "CourseSettings_courseId_key" ON "CourseSettings"("courseId");
CREATE UNIQUE INDEX "SkillCheckCompletion_skillCheckId_userId_key" ON "SkillCheckCompletion"("skillCheckId", "userId");
CREATE UNIQUE INDEX "CourseItemProgress_userId_courseItemId_key" ON "CourseItemProgress"("userId", "courseItemId");

CREATE INDEX "CourseItem_moduleId_sortOrder_idx" ON "CourseItem"("moduleId", "sortOrder");
CREATE INDEX "CourseItem_courseId_idx" ON "CourseItem"("courseId");
CREATE INDEX "CourseEnrollmentAssignment_courseId_idx" ON "CourseEnrollmentAssignment"("courseId");

-- Foreign keys
ALTER TABLE "SkillCheckStep" ADD CONSTRAINT "SkillCheckStep_skillCheckId_fkey" FOREIGN KEY ("skillCheckId") REFERENCES "SkillCheck"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SkillCheckCompletion" ADD CONSTRAINT "SkillCheckCompletion_skillCheckId_fkey" FOREIGN KEY ("skillCheckId") REFERENCES "SkillCheck"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SkillCheckCompletion" ADD CONSTRAINT "SkillCheckCompletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SkillCheckCompletion" ADD CONSTRAINT "SkillCheckCompletion_evaluatedById_fkey" FOREIGN KEY ("evaluatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CourseItem" ADD CONSTRAINT "CourseItem_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseItem" ADD CONSTRAINT "CourseItem_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseItem" ADD CONSTRAINT "CourseItem_legacyLessonId_fkey" FOREIGN KEY ("legacyLessonId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CourseItem" ADD CONSTRAINT "CourseItem_lessonContentId_fkey" FOREIGN KEY ("lessonContentId") REFERENCES "LessonContent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CourseItem" ADD CONSTRAINT "CourseItem_videoLessonId_fkey" FOREIGN KEY ("videoLessonId") REFERENCES "VideoLesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CourseItem" ADD CONSTRAINT "CourseItem_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CourseItem" ADD CONSTRAINT "CourseItem_skillCheckId_fkey" FOREIGN KEY ("skillCheckId") REFERENCES "SkillCheck"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CourseItem" ADD CONSTRAINT "CourseItem_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CourseSettings" ADD CONSTRAINT "CourseSettings_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseEnrollmentAssignment" ADD CONSTRAINT "CourseEnrollmentAssignment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseItemProgress" ADD CONSTRAINT "CourseItemProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseItemProgress" ADD CONSTRAINT "CourseItemProgress_courseItemId_fkey" FOREIGN KEY ("courseItemId") REFERENCES "CourseItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
