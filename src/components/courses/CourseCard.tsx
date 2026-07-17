import Link from "next/link";
import { BookOpen, Clock } from "lucide-react";
import type { Course, CourseCertificationInfo } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";

function formatHours(hours: number): string {
  const rounded = Math.round(hours * 10) / 10;
  if (rounded === 1) return "1 hour";
  return `${rounded} hours`;
}

function certificationDisplayTitle(title: string): string {
  const trimmed = title.trim();
  if (/certificat/i.test(trimmed)) return trimmed;
  return `${trimmed} Certification`;
}

function certificationCaption(
  cert: CourseCertificationInfo,
  estimatedHours: number
): string {
  const label = certificationDisplayTitle(cert.title);
  if (cert.totalCourses > 1) {
    return `${label} (${cert.completedCourses}/${cert.totalCourses})`;
  }
  return `${label} (${formatHours(estimatedHours)})`;
}

function CourseCertBadge({
  cert,
  estimatedHours,
}: {
  cert: CourseCertificationInfo;
  estimatedHours: number;
}) {
  return (
    <div className="flex max-w-[12rem] items-center gap-2 sm:max-w-[15rem]">
      {cert.badgeUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={cert.badgeUrl}
          alt=""
          className="h-10 w-10 shrink-0 rounded-full object-cover"
        />
      ) : (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-storm-navy/10 text-xs font-semibold text-storm-navy">
          ★
        </div>
      )}
      <div className="min-w-0 text-right">
        <p className="text-[11px] font-medium leading-snug text-storm-navy sm:text-xs">
          {certificationCaption(cert, estimatedHours)}
        </p>
        {cert.totalCourses > 1 ? (
          <p className="mt-0.5 text-[10px] text-storm-navy/55">
            {formatHours(estimatedHours)}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function CourseCard({ course }: { course: Course }) {
  const certs = course.certifications ?? [];

  return (
    <Link
      href={`/courses/${course.id}`}
      className="block rounded-xl border border-storm-light-blue/60 bg-white p-5 shadow-sm no-underline transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Badge variant="info">{course.category}</Badge>
          {course.progress === 100 && <Badge variant="success">Complete</Badge>}
        </div>
        {certs.length > 0 ? (
          <div className="flex shrink-0 flex-col items-end gap-2">
            {certs.map((cert) => (
              <CourseCertBadge
                key={cert.ruleId}
                cert={cert}
                estimatedHours={course.estimatedHours}
              />
            ))}
          </div>
        ) : null}
      </div>

      <h3 className="font-title mt-3 text-lg font-bold text-storm-navy">
        {course.title}
      </h3>
      <p className="mt-2 line-clamp-2 text-sm text-storm-navy/70">
        {course.description}
      </p>

      <div className="mt-4 flex gap-4 text-xs text-storm-navy/60">
        <span className="flex items-center gap-1">
          <BookOpen className="h-3.5 w-3.5" />
          {course.lessonCount} lessons
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          ~{course.estimatedHours}h
        </span>
      </div>

      <div className="mt-4">
        <ProgressBar value={course.progress} label="Progress" />
      </div>
    </Link>
  );
}
