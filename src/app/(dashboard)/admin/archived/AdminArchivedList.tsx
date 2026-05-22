"use client";

import { AdminEntityActions, type AdminEntityType } from "@/components/admin/AdminEntityActions";
import Link from "next/link";

type ArchivedData = {
  courses: { id: string; title: string; slug: string; archivedAt: Date | null }[];
  exams: { id: string; title: string; archivedAt: Date | null }[];
  users: { id: string; name: string | null; email: string; archivedAt: Date | null }[];
  certRules: {
    id: string;
    title: string;
    archivedAt: Date | null;
    course: { title: string };
  }[];
  manuals: { id: string; title: string; archivedAt: Date | null }[];
  lessons: {
    id: string;
    title: string;
    archivedAt: Date | null;
    module: { course: { title: string } };
  }[];
  grading: {
    attemptId: string;
    archivedAt: Date | null;
    attempt: {
      exam: { title: string };
      user: { name: string | null; email: string };
    };
  }[];
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="font-title text-lg font-bold text-storm-navy">{title}</h2>
      {children}
    </section>
  );
}

function Row({
  title,
  subtitle,
  href,
  type,
  id,
  archivedAt,
}: {
  title: string;
  subtitle?: string;
  href?: string;
  type: AdminEntityType;
  id: string;
  archivedAt: Date | null;
}) {
  return (
    <li className="rounded-xl border bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          {href ? (
            <Link href={href} className="font-medium text-storm-navy no-underline hover:underline">
              {title}
            </Link>
          ) : (
            <p className="font-medium text-storm-navy">{title}</p>
          )}
          {subtitle && <p className="text-sm text-storm-navy/60">{subtitle}</p>}
          {archivedAt && (
            <p className="mt-1 text-xs text-storm-navy/50">
              Archived {new Date(archivedAt).toLocaleString()}
            </p>
          )}
        </div>
        <AdminEntityActions type={type} id={id} name={title} archived compact />
      </div>
    </li>
  );
}

export function AdminArchivedList({ data }: { data: ArchivedData }) {
  return (
    <div className="space-y-10">
      {data.courses.length > 0 && (
        <Section title="Courses">
          <ul className="space-y-3">
            {data.courses.map((c) => (
              <Row
                key={c.id}
                type="course"
                id={c.id}
                title={c.title}
                subtitle={c.slug}
                href={`/admin/courses/${c.slug}`}
                archivedAt={c.archivedAt}
              />
            ))}
          </ul>
        </Section>
      )}

      {data.exams.length > 0 && (
        <Section title="Exams">
          <ul className="space-y-3">
            {data.exams.map((e) => (
              <Row
                key={e.id}
                type="exam"
                id={e.id}
                title={e.title}
                href={`/admin/exams/${e.id}`}
                archivedAt={e.archivedAt}
              />
            ))}
          </ul>
        </Section>
      )}

      {data.grading.length > 0 && (
        <Section title="Grading (inbox items)">
          <ul className="space-y-3">
            {data.grading.map((g) => (
              <Row
                key={g.attemptId}
                type="gradingAttempt"
                id={g.attemptId}
                title={g.attempt.exam.title}
                subtitle={g.attempt.user.name ?? g.attempt.user.email}
                href={`/admin/grading/${g.attemptId}`}
                archivedAt={g.archivedAt}
              />
            ))}
          </ul>
        </Section>
      )}

      {data.users.length > 0 && (
        <Section title="Users">
          <ul className="space-y-3">
            {data.users.map((u) => (
              <Row
                key={u.id}
                type="user"
                id={u.id}
                title={u.name ?? u.email}
                subtitle={u.name ? u.email : undefined}
                archivedAt={u.archivedAt}
              />
            ))}
          </ul>
        </Section>
      )}

      {data.certRules.length > 0 && (
        <Section title="Certifications">
          <ul className="space-y-3">
            {data.certRules.map((r) => (
              <Row
                key={r.id}
                type="certificationRule"
                id={r.id}
                title={r.title}
                subtitle={r.course.title}
                archivedAt={r.archivedAt}
              />
            ))}
          </ul>
        </Section>
      )}

      {data.manuals.length > 0 && (
        <Section title="Manuals (media)">
          <ul className="space-y-3">
            {data.manuals.map((m) => (
              <Row
                key={m.id}
                type="manual"
                id={m.id}
                title={m.title}
                archivedAt={m.archivedAt}
              />
            ))}
          </ul>
        </Section>
      )}

      {data.lessons.length > 0 && (
        <Section title="Video lessons (media)">
          <ul className="space-y-3">
            {data.lessons.map((l) => (
              <Row
                key={l.id}
                type="lesson"
                id={l.id}
                title={l.title}
                subtitle={l.module.course.title}
                archivedAt={l.archivedAt}
              />
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
