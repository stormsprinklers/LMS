/**
 * Backfill existing courses into CourseItem / CourseSettings / CourseItemProgress.
 * Run: npx tsx prisma/migrate-courses-to-builder.ts
 */
import { PrismaClient, CourseItemType, ContentStatus, CourseStatus } from "@prisma/client";

const prisma = new PrismaClient();

function manualBodyHtml(title: string, manualTitle?: string) {
  const ref = manualTitle ?? title;
  return `<p>This content has moved from the course manual step to a structured lesson.</p><p>Reference material: <strong>${ref}</strong> — find it in the <a href="/manuals">Manuals library</a>.</p>`;
}

function manualBodyJson(title: string, manualTitle?: string) {
  const ref = manualTitle ?? title;
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "This content has moved from the course manual step to a structured lesson.",
          },
        ],
      },
      {
        type: "callout",
        attrs: { variant: "info" },
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: `Reference: ${ref}. See the Manuals library for PDFs.` },
            ],
          },
        ],
      },
    ],
  };
}

async function main() {
  const courses = await prisma.course.findMany({
    include: {
      modules: {
        orderBy: { sortOrder: "asc" },
        include: {
          lessons: {
            orderBy: { sortOrder: "asc" },
            include: {
              videoAsset: true,
              manualAsset: true,
              exam: true,
              progress: true,
            },
          },
        },
      },
    },
  });

  for (const course of courses) {
    const status: CourseStatus = course.archived
      ? "ARCHIVED"
      : course.published
        ? "PUBLISHED"
        : "DRAFT";

    await prisma.course.update({
      where: { id: course.id },
      data: {
        shortDescription: course.description.slice(0, 280),
        estimatedMinutes: Math.round((course.estimatedHours ?? 0) * 60),
        status,
        publishedAt: course.published ? course.updatedAt : null,
      },
    });

    const existingSettings = await prisma.courseSettings.findUnique({
      where: { courseId: course.id },
    });
    if (!existingSettings) {
      await prisma.courseSettings.create({
        data: {
          courseId: course.id,
          visibility: course.published ? "PUBLIC" : "PRIVATE",
          enrollmentMode: "MANUAL",
        },
      });
    }

    for (const mod of course.modules) {
      await prisma.module.update({
        where: { id: mod.id },
        data: {
          status: ContentStatus.PUBLISHED,
          unlockRule: mod.sortOrder === 0 ? "ALWAYS" : "PREVIOUS_MODULE_COMPLETE",
        },
      });

      for (const lesson of mod.lessons) {
        const existing = await prisma.courseItem.findUnique({
          where: { legacyLessonId: lesson.id },
        });
        if (existing) continue;

        let itemType: CourseItemType;
        let track: "LEARN" | "PRACTICE" | "PROVE" = "LEARN";
        let lessonContentId: string | undefined;
        let videoLessonId: string | undefined;
        let examId: string | undefined;
        let completionRule = "manual";

        if (lesson.type === "VIDEO") {
          itemType = "VIDEO";
          track = "LEARN";
          const vl = await prisma.videoLesson.create({
            data: {
              muxAssetId: lesson.videoAsset?.muxAssetId ?? null,
              muxPlaybackId: lesson.videoAsset?.muxPlaybackId ?? null,
              durationSeconds: lesson.videoAsset?.durationSeconds ?? null,
              requiredWatchPercent: 80,
              completionRule: "watch_percent",
              status: lesson.videoAsset?.status ?? "pending",
            },
          });
          videoLessonId = vl.id;
          completionRule = "watch_percent";
        } else if (lesson.type === "EXAM") {
          itemType = "EXAM";
          track = "PROVE";
          examId = lesson.exam?.id;
          completionRule = "quiz_passed";
        } else if (lesson.type === "MANUAL") {
          itemType = "LESSON";
          track = "LEARN";
          const lc = await prisma.lessonContent.create({
            data: {
              bodyJson: manualBodyJson(lesson.title, lesson.manualAsset?.title),
              bodyHtml: manualBodyHtml(lesson.title, lesson.manualAsset?.title),
              completionRule: "viewed",
            },
          });
          lessonContentId = lc.id;
          completionRule = "viewed";
          if (lesson.manualAsset) {
            await prisma.manualAsset.update({
              where: { id: lesson.manualAsset.id },
              data: { lessonId: null },
            });
          }
        } else {
          itemType = "LESSON";
          const lc = await prisma.lessonContent.create({
            data: { completionRule: "viewed" },
          });
          lessonContentId = lc.id;
          completionRule = "viewed";
        }

        const item = await prisma.courseItem.create({
          data: {
            courseId: course.id,
            moduleId: mod.id,
            itemType,
            title: lesson.title,
            sortOrder: lesson.sortOrder,
            isRequired: true,
            estimatedMinutes: lesson.durationMinutes ?? undefined,
            completionRule,
            status: lesson.archived ? ContentStatus.ARCHIVED : ContentStatus.PUBLISHED,
            track,
            legacyLessonId: lesson.id,
            lessonContentId,
            videoLessonId,
            examId,
          },
        });

        if (lesson.exam && !lesson.exam.courseId) {
          await prisma.exam.update({
            where: { id: lesson.exam.id },
            data: { courseId: course.id },
          });
        }

        for (const lp of lesson.progress) {
          const exists = await prisma.courseItemProgress.findUnique({
            where: {
              userId_courseItemId: {
                userId: lp.userId,
                courseItemId: item.id,
              },
            },
          });
          if (!exists) {
            await prisma.courseItemProgress.create({
              data: {
                userId: lp.userId,
                courseItemId: item.id,
                status: lp.status,
                watchedSeconds: lp.watchedSeconds,
              },
            });
          }
        }
      }
    }
  }

  console.log(`Migrated ${courses.length} course(s) to course builder structure.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
