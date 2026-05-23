import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth-utils";
import { isCoursePreviewRequest } from "@/lib/courses/preview";
import { markCourseItemViewed } from "@/lib/courses/completion";
import { getCourseProgressMap } from "@/lib/courses/completion";
import { prisma } from "@/lib/db";
import { CourseItemVideoView } from "./CourseItemVideoView";
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

  const progressMap = await getCourseProgressMap(session.user.id, item.courseId);
  const progress = progressMap.get(item.id);
  const backHref = `/courses/${slug}${preview ? "?preview=1" : ""}`;

  if (item.itemType === "LESSON" && item.completionRule === "viewed" && !preview) {
    await markCourseItemViewed(session.user.id, itemId);
  }

  if (item.itemType === "SCENARIO" && !preview) {
    await markCourseItemViewed(session.user.id, itemId);
  }

  return (
    <>
      {preview && (
        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          Preview mode
          {item.status === "DRAFT" && " — this item is still a draft for trainees"}
        </div>
      )}
      <Link
        href={backHref}
        className="text-sm text-storm-medium-blue no-underline hover:underline"
      >
        ← {item.course.title}
      </Link>
      <h1 className="font-title mt-4 text-2xl font-bold text-storm-navy">{item.title}</h1>

      {item.itemType === "VIDEO" && (
        <CourseItemVideoView
          courseItemId={item.id}
          playbackId={item.videoLesson?.muxPlaybackId ?? null}
          videoUrl={item.videoLesson?.videoUrl ?? null}
          initialSeconds={progress?.watchedSeconds ?? 0}
          estimatedMinutes={item.estimatedMinutes}
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
    </>
  );
}
