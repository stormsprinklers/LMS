"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  generateCourseCertificationBadge,
  getCourseCertificationConfig,
  upsertCourseCertification,
} from "@/lib/actions/certifications";

const inputClass =
  "mt-1 w-full min-h-11 rounded-lg border border-storm-light-blue/60 px-3 py-2 text-sm";

type CourseOption = { id: string; title: string; slug: string };

type RuleState = {
  id?: string;
  title: string;
  description: string;
  enabled: boolean;
  validityMonths: number;
  badgeUrl: string | null;
  prerequisiteCourseIds: string[];
};

export function CertificationTab({ courseId, courseTitle }: { courseId: string; courseTitle: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [rule, setRule] = useState<RuleState>({
    title: `${courseTitle} Certificate`,
    description: "",
    enabled: true,
    validityMonths: 12,
    badgeUrl: null,
    prerequisiteCourseIds: [],
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const [badgeBusy, setBadgeBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await getCourseCertificationConfig(courseId);
        if (cancelled) return;
        setCourses(data.courses);
        if (data.rule) {
          setRule({
            id: data.rule.id,
            title: data.rule.title,
            description: data.rule.description ?? "",
            enabled: data.rule.enabled,
            validityMonths: data.rule.validityMonths,
            badgeUrl: data.rule.badgeUrl,
            prerequisiteCourseIds: data.rule.prerequisiteCourseIds,
          });
        }
      } catch {
        if (!cancelled) setError("Failed to load certification settings.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  function togglePrereq(id: string) {
    setRule((prev) => ({
      ...prev,
      prerequisiteCourseIds: prev.prerequisiteCourseIds.includes(id)
        ? prev.prerequisiteCourseIds.filter((x) => x !== id)
        : [...prev.prerequisiteCourseIds, id],
    }));
  }

  function save() {
    setError("");
    setMessage("");
    startTransition(async () => {
      const result = await upsertCourseCertification(courseId, {
        title: rule.title,
        description: rule.description,
        enabled: rule.enabled,
        validityMonths: rule.validityMonths,
        prerequisiteCourseIds: rule.prerequisiteCourseIds,
      });
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      setMessage("Certification saved.");
      if (result.ruleId) setRule((prev) => ({ ...prev, id: result.ruleId }));
      router.refresh();
    });
  }

  async function generateBadge() {
    setBadgeBusy(true);
    setError("");
    setMessage("");
    try {
      // Persist title first so badge uses current name
      const saved = await upsertCourseCertification(courseId, {
        title: rule.title,
        description: rule.description,
        enabled: rule.enabled,
        validityMonths: rule.validityMonths,
        prerequisiteCourseIds: rule.prerequisiteCourseIds,
      });
      if ("error" in saved && saved.error) {
        setError(saved.error);
        return;
      }
      const result = await generateCourseCertificationBadge(courseId);
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      if (result.badgeUrl) {
        setRule((prev) => ({ ...prev, badgeUrl: result.badgeUrl!, id: saved.ruleId ?? prev.id }));
        setMessage("Badge generated.");
      }
      router.refresh();
    } finally {
      setBadgeBusy(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-storm-navy/60">Loading certification…</p>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-4 rounded-xl border bg-white p-4 sm:p-6">
        <div>
          <h2 className="font-medium text-storm-navy">Course certification</h2>
          <p className="mt-1 text-sm text-storm-navy/60">
            Learners earn this certificate when they complete this course
            {rule.prerequisiteCourseIds.length
              ? " and all required prerequisite courses"
              : ""}
            . A PDF is emailed automatically.
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm text-storm-navy">
          <input
            type="checkbox"
            checked={rule.enabled}
            onChange={(e) => setRule((prev) => ({ ...prev, enabled: e.target.checked }))}
            className="h-4 w-4 rounded border-storm-light-blue"
          />
          Issue certificate when requirements are met
        </label>

        <label className="block text-sm text-storm-navy">
          Title
          <input
            className={inputClass}
            value={rule.title}
            onChange={(e) => setRule((prev) => ({ ...prev, title: e.target.value }))}
            required
          />
        </label>

        <label className="block text-sm text-storm-navy">
          Description
          <textarea
            className={`${inputClass} min-h-24`}
            value={rule.description}
            onChange={(e) => setRule((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="What this certification represents…"
          />
        </label>

        <label className="block text-sm text-storm-navy">
          Validity (months)
          <input
            type="number"
            min={1}
            max={120}
            className={inputClass}
            value={rule.validityMonths}
            onChange={(e) =>
              setRule((prev) => ({
                ...prev,
                validityMonths: Number(e.target.value) || 12,
              }))
            }
          />
        </label>

        <div>
          <p className="text-sm font-medium text-storm-navy">Also require these courses</p>
          <p className="mt-1 text-xs text-storm-navy/60">
            Optional. All selected courses must be completed before this certificate is awarded.
          </p>
          <ul className="mt-3 max-h-56 space-y-2 overflow-y-auto rounded-lg border border-storm-light-blue/50 p-3">
            {courses.length === 0 ? (
              <li className="text-sm text-storm-navy/50">No other courses available.</li>
            ) : (
              courses.map((c) => (
                <li key={c.id}>
                  <label className="flex items-center gap-2 text-sm text-storm-navy">
                    <input
                      type="checkbox"
                      checked={rule.prerequisiteCourseIds.includes(c.id)}
                      onChange={() => togglePrereq(c.id)}
                      className="h-4 w-4 rounded border-storm-light-blue"
                    />
                    {c.title}
                  </label>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="min-h-11 rounded-lg bg-storm-medium-blue px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save certification"}
          </button>
          <button
            type="button"
            onClick={() => void generateBadge()}
            disabled={badgeBusy || !rule.title.trim()}
            className="min-h-11 rounded-lg border border-storm-medium-blue/50 px-4 text-sm font-semibold text-storm-medium-blue disabled:opacity-50"
          >
            {badgeBusy
              ? "Generating badge…"
              : rule.badgeUrl
                ? "Regenerate badge with AI"
                : "Generate badge with AI"}
          </button>
        </div>

        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        {message ? <p className="text-sm text-green-700">{message}</p> : null}
      </div>

      <aside className="space-y-4">
        <div className="rounded-xl border bg-white p-4">
          <p className="text-sm font-medium text-storm-navy">Badge</p>
          {rule.badgeUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={rule.badgeUrl}
              alt=""
              className="mx-auto mt-3 h-40 w-40 rounded-full object-cover"
            />
          ) : (
            <div className="mt-3 flex h-40 items-center justify-center rounded-lg bg-storm-light-grey/60 text-center text-xs text-storm-navy/50">
              Generate a badge to preview
            </div>
          )}
        </div>

        <div className="rounded-xl border bg-gradient-to-br from-slate-50 to-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-storm-medium-blue">
            Certificate preview
          </p>
          <p className="mt-4 text-xs text-storm-navy/50">This certifies that</p>
          <p className="mt-1 font-title text-lg font-bold text-storm-navy">Learner Name</p>
          <p className="mt-3 text-xs text-storm-navy/50">has earned</p>
          <p className="mt-1 text-base font-semibold text-storm-medium-blue">
            {rule.title || "Certificate title"}
          </p>
          {rule.description ? (
            <p className="mt-3 line-clamp-4 text-xs text-storm-navy/70">{rule.description}</p>
          ) : null}
          {rule.badgeUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={rule.badgeUrl} alt="" className="ml-auto mt-4 h-16 w-16 object-contain" />
          ) : null}
        </div>
      </aside>
    </div>
  );
}
