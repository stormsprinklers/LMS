import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth-utils";
import { isCoursePreviewRequest } from "@/lib/courses/preview";
import { markCourseItemViewed } from "@/lib/courses/completion";
import { getCourseProgressMap } from "@/lib/courses/completion";
import { getCourseItemNavigation } from "@/lib/courses/item-navigation";
import { DEFAULT_REQUIRED_WATCH_PERCENT } from "@/lib/courses/video-watch";
import { prisma } from "@/lib/db";
import { CourseItemVideoView } from "./CourseItemVideoView";
import { CourseItemPageClient } from "./CourseItemPageClient";
import { LessonItemView } from "./LessonItemView";

export default async function CourseItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; itemId: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { id: slug, itemId } = await params;
  const query = await searchParams;
  const session = await requireUser();
  const role = (session.user as { role?: string }).role;
  const preview = isCoursePreviewRequest(query.preview, role);

  const item = await prisma.courseItem.findFirst({
    where: {
      id: itemId,
      archived: false,
      course: { slug, archived: false },
      ...(preview ? {} : { status: { in: ["PUBLISHED", "READY"] } }),
    },
    include: {
      exam: { select: { id: true } },
      lessonContent: true,
      videoLesson: true,
      scenario: true,
      course: { select: { slug: true, title: true, published: true, status: true } },
    },
  });

  if (!item) notFound();

  if (
    !preview &&
    (!item.course.published || item.course.status !== "PUBLISHED")
  ) {
    notFound();
  }

  // Mark viewed/scenario complete before building nav so Next unlocks on this render.
  if (!preview) {
    if (
      (item.itemType === "LESSON" && item.completionRule === "viewed") ||
      item.itemType === "SCENARIO"
    ) {
      await markCourseItemViewed(session.user.id, itemId);
    }
  }

  const [progressMap, navigation] = await Promise.all([
    getCourseProgressMap(session.user.id, item.courseId),
    getCourseItemNavigation(slug, itemId, session.user.id, preview),
  ]);

  if (!navigation) notFound();

  const progress = progressMap.get(item.id);
  const previewQuery = preview ? "?preview=1" : "";
  const courseHref = `/courses/${slug}${previewQuery}`;

  const requiredWatchPercent =
    item.videoLesson?.requiredWatchPercent ?? DEFAULT_REQUIRED_WATCH_PERCENT;
  const durationSeconds =
    item.videoLesson?.durationSeconds ??
    (item.estimatedMinutes ? item.estimatedMinutes * 60 : 0);

  return (
    <>
      {preview && (
        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          Preview mode
          {item.status === "DRAFT" && " — this item is still a draft for trainees"}
        </div>
      )}

      <Link
        href={courseHref}
        className="text-sm text-storm-navy/60 no-underline hover:text-storm-medium-blue hover:underline"
      >
        {item.course.title}
      </Link>

      <h1 className="font-title mt-2 text-2xl font-bold text-storm-navy">{item.title}</h1>

      <CourseItemPageClient
        navigation={navigation}
        preview={preview}
        itemType={item.itemType}
        requiredWatchPercent={requiredWatchPercent}
        initialWatchedSeconds={progress?.watchedSeconds ?? 0}
        initialDurationSeconds={durationSeconds}
      >
        {item.itemType === "VIDEO" && (
          <CourseItemVideoView
            courseItemId={item.id}
            playbackId={item.videoLesson?.muxPlaybackId ?? null}
            videoUrl={item.videoLesson?.videoUrl ?? null}
            initialSeconds={progress?.watchedSeconds ?? 0}
            estimatedMinutes={item.estimatedMinutes}
            durationSeconds={item.videoLesson?.durationSeconds ?? null}
            preview={preview}
          />
        )}

        {item.itemType === "LESSON" && item.lessonContent && (
          <LessonItemView
            courseItemId={item.id}
            bodyHtml={item.lessonContent.bodyHtml}
            completionRule={item.completionRule}
          />
        )}

        {item.itemType === "LESSON" && !item.lessonContent && (
          <p className="mt-6 text-sm text-storm-navy/60">No lesson content yet.</p>
        )}

        {item.itemType === "SCENARIO" && item.scenario && (
          <div className="mt-6 space-y-4 rounded-xl border bg-white p-5">
            <p className="text-sm font-medium text-storm-navy">Scenario</p>
            <p className="whitespace-pre-wrap text-storm-navy">{item.scenario.prompt}</p>
            {item.scenario.backgroundInfo && (
              <div className="rounded-lg bg-storm-light-grey/50 p-4 text-sm">
                {item.scenario.backgroundInfo}
              </div>
            )}
          </div>
        )}

        {item.itemType === "SKILL_CHECK" && (
          <p className="mt-4 text-sm text-storm-navy/60">
            Your trainer will evaluate this skill check in the field. Contact your supervisor when
            ready for pass-off.
          </p>
        )}

        {(item.itemType === "EXAM" || item.itemType === "QUIZ") && item.exam && (
          <div className="mt-6">
            <a
              href={`/exams/${item.exam.id}/take`}
              className="inline-flex min-h-11 items-center rounded-lg bg-storm-medium-blue px-6 py-2.5 text-sm font-semibold text-white no-underline hover:bg-storm-medium-blue/90"
            >
              {item.itemType === "QUIZ" ? "Start quiz" : "Start exam"}
            </a>
          </div>
        )}
      </CourseItemPageClient>
    </>
  );
}
