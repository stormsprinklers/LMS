"use client";

import Link from "next/link";
import { updateCourseSettings } from "@/lib/actions/course-builder";
import type { CourseBuilderCourse } from "@/lib/course-builder/types";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { useBuilderFormDirty } from "../useBuilderFormDirty";

const inputClass =
  "mt-1 w-full min-h-11 rounded-lg border border-storm-light-blue/60 px-3 py-2 text-sm";

export function SettingsTab({ course }: { course: CourseBuilderCourse }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);
  const { resolveSave, formDirtyProps } = useBuilderFormDirty(`course-settings-${course.id}`, formRef);
  const [busy, setBusy] = useState(false);
  const s = course.settings;

  const certificationHref = (() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "certification");
    return `${pathname}?${params.toString()}`;
  })();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    try {
    await updateCourseSettings(course.id, {
      visibility: String(fd.get("visibility")) as "PRIVATE" | "UNLISTED" | "PUBLIC",
      enrollmentMode: String(fd.get("enrollmentMode")) as "MANUAL" | "AUTO" | "SELF_ENROLL",
      dueDateType: String(fd.get("dueDateType")) as "NONE" | "RELATIVE" | "FIXED",
      dueDaysAfterEnrollment: Number(fd.get("dueDays")) || null,
      requireAllLessons: fd.get("requireAllLessons") === "on",
      requireAllQuizzes: fd.get("requireAllQuizzes") === "on",
      requireAllSkillChecks: fd.get("requireAllSkillChecks") === "on",
      finalExamRequired: fd.get("finalExamRequired") === "on",
      finalExamPassingScore: Number(fd.get("finalExamPassingScore")) || null,
      notifyOnAssign: fd.get("notifyOnAssign") === "on",
      notifyReminder: fd.get("notifyReminder") === "on",
    });
    resolveSave(true);
    router.refresh();
    } catch {
      resolveSave(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      {...formDirtyProps}
      className="max-w-2xl space-y-4 rounded-xl border bg-white p-4 sm:p-6"
    >
      <h2 className="font-medium text-storm-navy">Course settings</h2>
      <label className="block text-sm">
        Visibility
        <select name="visibility" defaultValue={s?.visibility ?? "PRIVATE"} className={inputClass}>
          <option value="PRIVATE">Draft / private</option>
          <option value="UNLISTED">Published but hidden</option>
          <option value="PUBLIC">Published and visible</option>
        </select>
      </label>
      <label className="block text-sm">
        Enrollment
        <select
          name="enrollmentMode"
          defaultValue={s?.enrollmentMode ?? "MANUAL"}
          className={inputClass}
        >
          <option value="MANUAL">Admin assigns manually</option>
          <option value="AUTO">Auto-assign new trainees</option>
          <option value="SELF_ENROLL">Self-enrollment</option>
        </select>
      </label>
      <label className="block text-sm">
        Due date
        <select name="dueDateType" defaultValue={s?.dueDateType ?? "NONE"} className={inputClass}>
          <option value="NONE">No due date</option>
          <option value="RELATIVE">Due X days after assignment</option>
          <option value="FIXED">Fixed date</option>
        </select>
      </label>
      <label className="block text-sm">
        Days after enrollment
        <input
          name="dueDays"
          type="number"
          min={0}
          defaultValue={s?.dueDaysAfterEnrollment ?? ""}
          className={inputClass}
        />
      </label>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Completion rules</legend>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="requireAllLessons"
            defaultChecked={s?.requireAllLessons ?? true}
            className="h-4 w-4"
          />
          Complete all required lessons
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="requireAllQuizzes"
            defaultChecked={s?.requireAllQuizzes ?? true}
            className="h-4 w-4"
          />
          Pass all required quizzes
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="requireAllSkillChecks"
            defaultChecked={s?.requireAllSkillChecks ?? true}
            className="h-4 w-4"
          />
          Complete all skill checks
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="finalExamRequired"
            defaultChecked={s?.finalExamRequired ?? false}
            className="h-4 w-4"
          />
          Final exam required
        </label>
        <label className="block text-sm">
          Final exam passing score %
          <input
            name="finalExamPassingScore"
            type="number"
            min={0}
            max={100}
            defaultValue={s?.finalExamPassingScore ?? 80}
            className={inputClass}
          />
        </label>
        <p className="rounded-lg border border-storm-light-blue/50 bg-storm-light-grey/40 px-3 py-2 text-sm text-storm-navy/80">
          Certificate issuance is configured on the{" "}
          <Link href={certificationHref} className="font-medium text-storm-medium-blue underline">
            Certification
          </Link>{" "}
          tab.
        </p>
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Notifications</legend>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="notifyOnAssign"
            defaultChecked={s?.notifyOnAssign ?? true}
            className="h-4 w-4"
          />
          Notify on assignment
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="notifyReminder"
            defaultChecked={s?.notifyReminder ?? false}
            className="h-4 w-4"
          />
          Send reminder before due date
        </label>
      </fieldset>
      <button
        type="submit"
        disabled={busy}
        className="min-h-11 rounded-lg bg-storm-medium-blue px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}
