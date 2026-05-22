import type { GradeVisibility } from "@prisma/client";

/** Learners only see scores after admin clicks "Publish grades". */
export function holdsGradesUntilAdminPublish(
  gradeVisibility: GradeVisibility,
): boolean {
  return gradeVisibility === "ADMIN_ONLY";
}

/** Learners may see scores as soon as their attempt is fully graded. */
export function gradesVisibleToLearner(
  gradeVisibility: GradeVisibility,
  gradesPublishedAt: Date | null,
  attemptPendingReview: boolean,
): boolean {
  if (attemptPendingReview) return false;
  if (holdsGradesUntilAdminPublish(gradeVisibility)) {
    return gradesPublishedAt !== null;
  }
  return true;
}
