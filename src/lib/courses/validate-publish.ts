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
              lessonContent: true,
              videoLesson: true,
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
      if (item.itemType === "LESSON") {
        const html = item.lessonContent?.bodyHtml?.trim() ?? "";
        const json = item.lessonContent?.bodyJson;
        const hasJson =
          json &&
          typeof json === "object" &&
          "content" in (json as object) &&
          Array.isArray((json as { content?: unknown[] }).content) &&
          ((json as { content: unknown[] }).content?.length ?? 0) > 0;
        if (!html && !hasJson) {
          issues.push({
            level: "warning",
            message: `Lesson "${item.title}" has no body content.`,
          });
        }
      }
      if (item.itemType === "VIDEO") {
        const vl = item.videoLesson;
        const hasPlayback =
          vl?.muxPlaybackId?.trim() ||
          vl?.videoUrl?.trim() ||
          vl?.transcript?.trim();
        if (!hasPlayback) {
          issues.push({
            level: "warning",
            message: `Video "${item.title}" has no playback URL, Mux asset, or transcript.`,
          });
        }
        if (vl?.status === "pending" && !vl?.muxPlaybackId && !vl?.videoUrl) {
          issues.push({
            level: "warning",
            message: `Video "${item.title}" is still pending upload.`,
          });
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
