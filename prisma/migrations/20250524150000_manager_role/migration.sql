-- Manager role: create courses/exams, edit only own content; no delete/archive
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'MANAGER';
