import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ClipboardCheck,
  FileText,
  PlayCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { requireUser } from "@/lib/auth-utils";
import { getCourseBySlug } from "@/lib/repositories/courses";
import type { ContentType, LessonStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { prisma } from "@/lib/db";

const lessonIcons: Record<ContentType, typeof PlayCircle> = {
  video: PlayCircle,
  manual: FileText,
  exam: ClipboardCheck,
};

const statusLabels: Record<LessonStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  completed: "Completed",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return { title: id };
}

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireUser();
  const course = await getCourseBySlug(id, session.user.id);

  if (!course) notFound();

  const dbCourse = await prisma.course.findUnique({
    where: { slug: id },
    include: {
      modules: {
        include: { lessons: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });

  const lessonIdBySlug = new Map(
    dbCourse?.modules.flatMap((m) => m.lessons).map((l) => [l.slug, l.id]) ?? [],
  );

  return (
    <>
      <Link
        href="/courses"
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-storm-medium-blue no-underline hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to courses
      </Link>

      <div className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <div className="flex flex-wrap gap-2">
            <Badge variant="info">{course.category}</Badge>
            {course.requiredForRole?.map((role) => (
              <Badge key={role} variant="pink">
                {role}
              </Badge>
            ))}
          </div>
          <h1 className="font-title mt-3 text-2xl font-bold text-storm-navy sm:text-3xl break-words">
            {course.title}
          </h1>
          <p className="mt-3 text-storm-navy/70">{course.description}</p>
          <p className="mt-4 text-sm text-storm-navy/60">
            {course.lessonCount} lessons · ~{course.estimatedHours} hours
          </p>
        </div>

        <Card className="w-full max-w-sm shrink-0">
          <ProgressBar value={course.progress} label="Your progress" />
        </Card>
      </div>

      <h2 className="font-title mb-4 text-lg font-bold text-storm-navy">
        Course content
      </h2>
      <ul className="space-y-3">
        {course.lessons.map((lesson, index) => {
          const Icon = lessonIcons[lesson.type];
          const lessonDbId = lessonIdBySlug.get(lesson.id);
          const href =
            lesson.type === "video" && lessonDbId
              ? `/courses/${id}/lessons/${lessonDbId}`
              : lesson.type === "exam"
                ? `/exams`
                : `/manuals`;

          return (
            <li key={lesson.id}>
              <Link href={href} className="block no-underline">
                <Card className="flex items-center gap-4 hover:border-storm-medium-blue/40">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-storm-light-blue text-sm font-bold text-storm-navy">
                    {index + 1}
                  </span>
                  <Icon className="h-5 w-5 shrink-0 text-storm-medium-blue" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-storm-navy">{lesson.title}</p>
                    <p className="text-xs capitalize text-storm-navy/60">
                      {lesson.type}
                      {lesson.durationMinutes
                        ? ` · ${lesson.durationMinutes} min`
                        : ""}
                    </p>
                  </div>
                  <Badge
                    variant={
                      lesson.status === "completed"
                        ? "success"
                        : lesson.status === "in_progress"
                          ? "warning"
                          : "default"
                    }
                    className={cn("shrink-0")}
                  >
                    {statusLabels[lesson.status]}
                  </Badge>
                </Card>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
