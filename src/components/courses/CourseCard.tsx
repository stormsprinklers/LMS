import Link from "next/link";
import { BookOpen, Clock } from "lucide-react";
import type { Course } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";

export function CourseCard({ course }: { course: Course }) {
  return (
    <Link
      href={`/courses/${course.id}`}
      className="block rounded-xl border border-storm-light-blue/60 bg-white p-5 shadow-sm no-underline transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <Badge variant="info">{course.category}</Badge>
        {course.progress === 100 && <Badge variant="success">Complete</Badge>}
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
