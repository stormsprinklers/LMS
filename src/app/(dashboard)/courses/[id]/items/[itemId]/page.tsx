import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";
import { markCourseItemViewed } from "@/lib/courses/completion";
import { LessonItemView } from "./LessonItemView";

export default async function CourseItemPage({
  params,
}: {
  params: Promise<{ id: string; itemId: string }>;
}) {
  const { id: slug, itemId } = await params;
  const session = await requireUser();

  const item = await prisma.courseItem.findFirst({
    where: {
      id: itemId,
      archived: false,
      course: { slug },
    },
    include: {
      lessonContent: true,
      scenario: true,
      course: { select: { slug: true, title: true } },
    },
  });

  if (!item) notFound();

  if (item.itemType === "LESSON" && item.completionRule === "viewed") {
    await markCourseItemViewed(session.user.id, itemId);
  }

  if (item.itemType === "SCENARIO") {
    await markCourseItemViewed(session.user.id, itemId);
  }

  return (
    <>
      <Link
        href={`/courses/${slug}`}
        className="text-sm text-storm-medium-blue no-underline hover:underline"
      >
        ← {item.course.title}
      </Link>
      <h1 className="font-title mt-4 text-2xl font-bold text-storm-navy">{item.title}</h1>

      {item.itemType === "LESSON" && item.lessonContent && (
        <LessonItemView
          courseItemId={item.id}
          bodyHtml={item.lessonContent.bodyHtml}
          completionRule={item.completionRule}
        />
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
