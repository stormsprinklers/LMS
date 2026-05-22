-- Fix exams saved with 0 attempts (invalid); minimum 1 for taking exams
UPDATE "Exam" SET "attemptsAllowed" = 3 WHERE "attemptsAllowed" < 1;
