import Link from "next/link";
import {
  Award,
  BookOpen,
  ClipboardCheck,
  GraduationCap,
  PlayCircle,
} from "lucide-react";
import { CourseCard } from "@/components/courses/CourseCard";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { requireUser } from "@/lib/auth-utils";
import { getCoursesForUser } from "@/lib/repositories/courses";
import { getCertificationsForUser } from "@/lib/repositories/certifications";
import { getExamsForUser } from "@/lib/repositories/exams";
import { getVideoTrainingsForUser } from "@/lib/repositories/training";

export default async function DashboardPage() {
  const session = await requireUser();
  const userId = session.user.id;

  const [courses, videos, exams, certifications] = await Promise.all([
    getCoursesForUser(userId),
    getVideoTrainingsForUser(userId),
    getExamsForUser(userId),
    getCertificationsForUser(userId),
  ]);

  const stats = [
    { label: "Active courses", value: courses.length, icon: GraduationCap, href: "/courses" },
    {
      label: "Videos in progress",
      value: videos.filter((v) => v.watchedPercent > 0 && v.watchedPercent < 100).length,
      icon: PlayCircle,
      href: "/training",
    },
    {
      label: "Exams available",
      value: exams.filter((e) => e.status === "available").length,
      icon: ClipboardCheck,
      href: "/exams",
    },
    {
      label: "Certifications",
      value: certifications.filter((c) => c.status === "earned").length,
      icon: Award,
      href: "/certifications",
    },
  ];

  const inProgress = courses.filter((c) => c.progress > 0 && c.progress < 100);
  const continueCourse = inProgress[0] ?? courses[0];

  return (
    <>
      <PageHeader
        title="Welcome back"
        description="Continue your training, complete required courses, and earn Storm Sprinklers certifications."
        action={
          <Link
            href="/courses"
            className="inline-flex items-center justify-center rounded-lg bg-storm-pink px-4 py-2.5 text-sm font-semibold text-white no-underline transition-opacity hover:opacity-90"
          >
            Browse all courses
          </Link>
        }
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, href }) => (
          <Link key={label} href={href} className="no-underline">
            <Card className="flex items-center gap-4 hover:border-storm-medium-blue/40">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-storm-light-blue text-storm-navy">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-storm-navy">{value}</p>
                <p className="text-sm text-storm-navy/60">{label}</p>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <h2 className="font-title mb-4 text-lg font-bold text-storm-navy">
            Continue learning
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {courses.slice(0, 2).map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        </section>

        <section className="space-y-4">
          {continueCourse && (
            <Card className="border-storm-medium-blue/30 bg-storm-light-blue/20">
              <p className="text-xs font-semibold uppercase tracking-wide text-storm-medium-blue">
                Up next
              </p>
              <h3 className="font-title mt-2 text-lg font-bold text-storm-navy">
                {continueCourse.title}
              </h3>
              <div className="mt-4">
                <ProgressBar value={continueCourse.progress} label="Course progress" />
              </div>
              <Link
                href={`/courses/${continueCourse.id}`}
                className="mt-4 inline-flex text-sm font-semibold text-storm-medium-blue no-underline hover:underline"
              >
                Resume course →
              </Link>
            </Card>
          )}

          <Card>
            <h3 className="font-title text-sm font-bold text-storm-navy">
              Required training
            </h3>
            <ul className="mt-3 space-y-3">
              {courses
                .filter((c) => c.progress < 100)
                .map((course) => (
                  <li
                    key={course.id}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <span className="text-storm-navy/80">{course.title}</span>
                    <Badge variant={course.progress > 0 ? "warning" : "pink"}>
                      {course.progress > 0 ? "In progress" : "Not started"}
                    </Badge>
                  </li>
                ))}
            </ul>
          </Card>

          <Card>
            <div className="flex items-center gap-2 text-storm-navy">
              <BookOpen className="h-5 w-5 text-storm-medium-blue" />
              <h3 className="font-title text-sm font-bold">Quick links</h3>
            </div>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link href="/manuals" className="text-storm-medium-blue no-underline hover:underline">
                  Field manuals & guides
                </Link>
              </li>
              <li>
                <Link href="/exams" className="text-storm-medium-blue no-underline hover:underline">
                  Take an exam
                </Link>
              </li>
              <li>
                <Link href="/certifications" className="text-storm-medium-blue no-underline hover:underline">
                  View certifications
                </Link>
              </li>
              {(session.user as { role?: string }).role === "ADMIN" && (
                <li>
                  <Link href="/admin" className="text-storm-medium-blue no-underline hover:underline">
                    Admin panel
                  </Link>
                </li>
              )}
            </ul>
          </Card>
        </section>
      </div>
    </>
  );
}
