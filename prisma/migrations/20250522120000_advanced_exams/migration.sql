-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('MULTIPLE_CHOICE', 'MULTIPLE_SELECT', 'FREE_RESPONSE', 'SLIDER', 'MATCHING');
CREATE TYPE "GradeVisibility" AS ENUM ('ADMIN_ONLY', 'LEARNER_VISIBLE');
CREATE TYPE "GradingTaskStatus" AS ENUM ('PENDING', 'COMPLETED');
CREATE TYPE "NotificationType" AS ENUM ('FREE_RESPONSE_TO_GRADE', 'GRADES_PUBLISHED');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'COURSE_ADMIN';
ALTER TYPE "ExamAttemptStatus" ADD VALUE 'SUBMITTED_PENDING_GRADE';

-- AlterTable Exam
ALTER TABLE "Exam" DROP CONSTRAINT "Exam_lessonId_fkey";
ALTER TABLE "Exam" ADD COLUMN "description" TEXT,
ADD COLUMN "courseId" TEXT,
ADD COLUMN "createdById" TEXT,
ADD COLUMN "shuffleQuestions" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "published" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "gradeVisibility" "GradeVisibility" NOT NULL DEFAULT 'ADMIN_ONLY',
ADD COLUMN "gradesPublishedAt" TIMESTAMP(3),
ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Exam" ALTER COLUMN "lessonId" DROP NOT NULL;
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill courseId from lesson path
UPDATE "Exam" e SET "courseId" = m."courseId"
FROM "Lesson" l JOIN "Module" m ON l."moduleId" = m.id
WHERE e."lessonId" = l.id AND e."courseId" IS NULL;

-- AlterTable Question
ALTER TABLE "Question" ADD COLUMN "type" "QuestionType" NOT NULL DEFAULT 'MULTIPLE_CHOICE',
ADD COLUMN "config" JSONB;

-- AlterTable ExamAttempt
ALTER TABLE "ExamAttempt" ADD COLUMN "pendingManualGrade" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "questionOrder" JSONB;

-- CreateTable
CREATE TABLE "CourseAdmin" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CourseAdmin_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CourseAdmin_userId_courseId_key" ON "CourseAdmin"("userId", "courseId");
ALTER TABLE "CourseAdmin" ADD CONSTRAINT "CourseAdmin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseAdmin" ADD CONSTRAINT "CourseAdmin_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ExamAssignment" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExamAssignment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ExamAssignment_examId_userId_key" ON "ExamAssignment"("examId", "userId");
ALTER TABLE "ExamAssignment" ADD CONSTRAINT "ExamAssignment_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExamAssignment" ADD CONSTRAINT "ExamAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ExamGrader" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExamGrader_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ExamGrader_examId_userId_key" ON "ExamGrader"("examId", "userId");
ALTER TABLE "ExamGrader" ADD CONSTRAINT "ExamGrader_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExamGrader" ADD CONSTRAINT "ExamGrader_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ExamAnswer" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "autoScore" DOUBLE PRECISION,
    "manualScore" DOUBLE PRECISION,
    "feedback" TEXT,
    "gradedById" TEXT,
    "gradedAt" TIMESTAMP(3),
    CONSTRAINT "ExamAnswer_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ExamAnswer_attemptId_questionId_key" ON "ExamAnswer"("attemptId", "questionId");
ALTER TABLE "ExamAnswer" ADD CONSTRAINT "ExamAnswer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "ExamAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExamAnswer" ADD CONSTRAINT "ExamAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExamAnswer" ADD CONSTRAINT "ExamAnswer_gradedById_fkey" FOREIGN KEY ("gradedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "GradingTask" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "courseId" TEXT,
    "status" "GradingTaskStatus" NOT NULL DEFAULT 'PENDING',
    "assignedToUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "GradingTask_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GradingTask_attemptId_questionId_key" ON "GradingTask"("attemptId", "questionId");
ALTER TABLE "GradingTask" ADD CONSTRAINT "GradingTask_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "ExamAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GradingTask" ADD CONSTRAINT "GradingTask_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GradingTask" ADD CONSTRAINT "GradingTask_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "readAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
