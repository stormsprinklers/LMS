import { prisma } from "@/lib/db";

export type ValidationIssue = {
  level: "error" | "warning";
  message: string;
};

export async function validateCourseForPublish(courseId: string) {
  const issues: ValidationIssue[] = [];
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      modules: {
        include: {
          courseItems: {
            where: { archived: false },
            include: {
              exam: { include: { questions: { include: { options: true } } } },
            },
          },
        },
      },
      settings: true,
    },
  });

  if (!course) {
    return { ok: false, issues: [{ level: "error", message: "Course not found." }] };
  }

  if (!course.title.trim()) {
    issues.push({ level: "error", message: "Course title is required." });
  }

  if (course.modules.length === 0) {
    issues.push({ level: "error", message: "Add at least one module." });
  }

  let itemCount = 0;
  for (const mod of course.modules) {
    if (!mod.title.trim()) {
      issues.push({ level: "error", message: "All modules need titles." });
    }
    for (const item of mod.courseItems) {
      itemCount++;
      if (item.itemType === "EXAM" || item.itemType === "QUIZ") {
        const exam = item.exam;
        if (!exam) {
          issues.push({
            level: "error",
            message: `Exam "${item.title}" is missing exam data.`,
          });
        } else {
          if (exam.questions.length === 0) {
            issues.push({
              level: "warning",
              message: `Exam "${item.title}" has no questions.`,
            });
          }
          for (const q of exam.questions) {
            if (q.type === "MULTIPLE_CHOICE" || q.type === "MULTIPLE_SELECT") {
              const hasCorrect = q.options.some((o) => o.isCorrect);
              if (!hasCorrect) {
                issues.push({
                  level: "warning",
                  message: `Question missing correct answer in "${item.title}".`,
                });
              }
            }
          }
          if (!exam.passingScore) {
            issues.push({
              level: "warning",
              message: `Exam "${item.title}" has no passing score.`,
            });
          }
        }
      }
      if (item.status === "DRAFT") {
        issues.push({
          level: "warning",
          message: `"${item.title}" is still a draft.`,
        });
      }
    }
  }

  if (itemCount === 0) {
    issues.push({ level: "error", message: "Add at least one curriculum item." });
  }

  const hasErrors = issues.some((i) => i.level === "error");
  return { ok: !hasErrors, issues };
}
