import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  ClipboardCheck,
  FileText,
  Film,
  GitBranch,
  HelpCircle,
  Lock,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { requireUser } from "@/lib/auth-utils";
import { getLearnerCourseCurriculum } from "@/lib/repositories/course-learner";
import type { CourseItemType } from "@prisma/client";
import { cn } from "@/lib/utils";
import { ITEM_TYPE_LABELS, TRACK_LABELS } from "@/lib/course-builder/types";

const itemIcons: Record<CourseItemType, typeof FileText> = {
  LESSON: FileText,
  VIDEO: Film,
  QUIZ: HelpCircle,
  EXAM: ClipboardCheck,
  SKILL_CHECK: BookOpen,
  SCENARIO: GitBranch,
};

export default async function CourseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const session = await requireUser();
  const preview = query.preview === "1" && session.user.role === "ADMIN";

  const course = await getLearnerCourseCurriculum(id, session.user.id, preview);
  if (!course) notFound();

  return (
    <>
      <Link
        href="/courses"
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-storm-medium-blue no-underline hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to courses
      </Link>

      {preview && (
        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          Preview mode — progression rules may differ for trainees.
        </div>
      )}

      <div className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <Badge variant="info">{course.category}</Badge>
          <h1 className="font-title mt-3 text-2xl font-bold text-storm-navy sm:text-3xl break-words">
            {course.title}
          </h1>
          <p className="mt-3 text-storm-navy/70">
            {course.shortDescription ?? course.description}
          </p>
          <p className="mt-4 text-sm text-storm-navy/60">
            {course.itemCount} activities · ~
            {course.estimatedMinutes
              ? `${Math.round(course.estimatedMinutes / 60)} hours`
              : `${course.estimatedHours} hours`}
          </p>
        </div>
        <Card className="w-full max-w-sm shrink-0">
          <ProgressBar value={course.progress} label="Your progress" />
        </Card>
      </div>

      <div className="space-y-8">
        {course.modules.map((mod, modIndex) => (
          <section key={mod.id}>
            <div className="mb-3 flex items-center gap-2">
              {!mod.unlocked && <Lock className="h-4 w-4 text-storm-navy/40" />}
              <h2 className="font-title text-lg font-bold text-storm-navy">
                Module {modIndex + 1}: {mod.title}
              </h2>
              {!mod.unlocked && (
                <Badge variant="default">Locked</Badge>
              )}
            </div>
            {mod.description && (
              <p className="mb-3 text-sm text-storm-navy/60">{mod.description}</p>
            )}
            <ul className="space-y-2">
              {mod.items.map((item, index) => {
                const Icon = itemIcons[item.itemType];
                const locked = item.access === "locked";
                const inner = (
                  <Card
                    className={cn(
                      "flex items-center gap-4",
                      !locked && "hover:border-storm-medium-blue/40",
                      locked && "opacity-60",
                    )}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-storm-light-blue text-sm font-bold text-storm-navy">
                      {index + 1}
                    </span>
                    <Icon className="h-5 w-5 shrink-0 text-storm-medium-blue" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-storm-navy">{item.title}</p>
                      <p className="text-xs text-storm-navy/60">
                        {ITEM_TYPE_LABELS[item.itemType]}
                        {item.estimatedMinutes ? ` · ${item.estimatedMinutes} min` : ""}
                        · {TRACK_LABELS[item.track as keyof typeof TRACK_LABELS]}
                      </p>
                    </div>
                    <Badge
                      variant={
                        item.access === "completed"
                          ? "success"
                          : item.access === "in_progress"
                            ? "warning"
                            : item.access === "locked"
                              ? "default"
                              : "info"
                      }
                      className="shrink-0 capitalize"
                    >
                      {item.access.replace("_", " ")}
                    </Badge>
                  </Card>
                );

                return (
                  <li key={item.id}>
                    {locked ? (
                      <div className="cursor-not-allowed">{inner}</div>
                    ) : (
                      <Link href={item.href} className="block no-underline">
                        {inner}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
