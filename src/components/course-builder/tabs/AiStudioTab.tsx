"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { CourseBuilderCourse } from "@/lib/course-builder/types";
import type { CourseBlueprint } from "@/lib/ai/blueprint-schema";
import type { BlueprintIssue } from "@/lib/ai/validate-blueprint";
import {
  applyCourseBlueprint,
  createAiSession,
  generateCourseBlueprint,
  processAiSession,
  reworkBlueprintSectionAction,
  updateAiSessionPrompt,
  uploadAiSource,
  deleteAiSourceAsset,
} from "@/lib/actions/ai-builder";
import { BlueprintPreview } from "../ai/BlueprintPreview";

type WizardStep = "intent" | "sources" | "processing" | "generate" | "preview" | "actions";

export function AiStudioTab({ course }: { course: CourseBuilderCourse }) {
  const router = useRouter();
  const [step, setStep] = useState<WizardStep>("intent");
  const [mode, setMode] = useState<"course" | "module" | "lesson">("course");
  const [targetModuleId, setTargetModuleId] = useState<string>("");
  const [userPrompt, setUserPrompt] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [assets, setAssets] = useState<
    {
      id: string;
      kind: string;
      filename: string | null;
      processingStatus: string;
      processingError: string | null;
      placementHint: string | null;
      blobUrl: string | null;
    }[]
  >([]);
  const [sourceNote, setSourceNote] = useState("");
  const [includeRecording, setIncludeRecording] = useState(true);
  const [sourceUrl, setSourceUrl] = useState("");
  const [urlKind, setUrlKind] = useState<"webpage" | "video">("webpage");
  const [pastedTitle, setPastedTitle] = useState("");
  const [pastedText, setPastedText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [blueprint, setBlueprint] = useState<CourseBlueprint | null>(null);
  const [issues, setIssues] = useState<BlueprintIssue[]>([]);
  const [selectedModule, setSelectedModule] = useState<number | null>(0);
  const [selectedItem, setSelectedItem] = useState<number | null>(null);
  const [reworkInstruction, setReworkInstruction] = useState("");

  const pollSession = useCallback(async (id: string) => {
    const res = await fetch(`/api/admin/ai-sessions/${id}`);
    if (!res.ok) return;
    const data = await res.json();
    setAssets(data.assets ?? []);
    if (data.blueprintJson) {
      setBlueprint(data.blueprintJson as CourseBlueprint);
    }
    if (data.status === "ready") setStep("preview");
    if (data.status === "failed" && data.error) setError(data.error);
  }, []);

  useEffect(() => {
    if (!sessionId || step !== "processing") return;
    const t = setInterval(() => pollSession(sessionId), 3000);
    return () => clearInterval(t);
  }, [sessionId, step, pollSession]);

  async function startSession() {
    setBusy(true);
    setError("");
    const result = await createAiSession(course.id, mode, {
      targetModuleId:
        mode !== "course" && targetModuleId ? targetModuleId : undefined,
      userPrompt,
    });
    setBusy(false);
    if (!result.session) {
      setError("Could not create session.");
      return;
    }
    setSessionId(result.session.id);
    setAssets(result.session.assets ?? []);
    setStep("sources");
  }

  function requireNote(): boolean {
    if (!sourceNote.trim()) {
      setError("Add a note describing this source (what it is and how to use it).");
      return false;
    }
    return true;
  }

  async function postSource(fd: FormData) {
    if (!sessionId) return false;
    fd.set("sourceNote", sourceNote.trim());
    const result = await uploadAiSource(sessionId, fd);
    if (result.error) {
      setError(result.error);
      return false;
    }
    return true;
  }

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!sessionId || !requireNote()) return;
    const form = e.currentTarget;
    const input = form.elements.namedItem("file") as HTMLInputElement | null;
    const files = input?.files;
    if (!files?.length) {
      setError("Choose at least one file.");
      return;
    }
    setBusy(true);
    setError("");
    let ok = true;
    for (let i = 0; i < files.length; i++) {
      const fd = new FormData();
      fd.set("file", files[i]);
      fd.set("includeRecording", includeRecording ? "true" : "false");
      if (!(await postSource(fd))) {
        ok = false;
        break;
      }
    }
    setBusy(false);
    if (ok) {
      form.reset();
      await pollSession(sessionId);
    }
  }

  async function handleAddUrl() {
    if (!sessionId || !requireNote()) return;
    if (!sourceUrl.trim()) {
      setError("Enter a URL.");
      return;
    }
    setBusy(true);
    setError("");
    const fd = new FormData();
    fd.set("sourceUrl", sourceUrl.trim());
    fd.set("urlKind", urlKind);
    fd.set("includeRecording", includeRecording ? "true" : "false");
    const ok = await postSource(fd);
    setBusy(false);
    if (ok) {
      setSourceUrl("");
      await pollSession(sessionId);
    }
  }

  async function handlePasteText() {
    if (!sessionId || !requireNote()) return;
    if (!pastedText.trim()) {
      setError("Paste some text to add as a source.");
      return;
    }
    setBusy(true);
    setError("");
    const fd = new FormData();
    fd.set("pastedText", pastedText.trim());
    if (pastedTitle.trim()) fd.set("pastedTitle", pastedTitle.trim());
    const ok = await postSource(fd);
    setBusy(false);
    if (ok) {
      setPastedText("");
      setPastedTitle("");
      await pollSession(sessionId);
    }
  }

  async function runProcessing() {
    if (!sessionId) return;
    setStep("processing");
    setBusy(true);
    setError("");
    const result = await processAiSession(sessionId);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    await pollSession(sessionId);
    setStep("generate");
  }

  async function runGenerate() {
    if (!sessionId) return;
    setBusy(true);
    setError("");
    await updateAiSessionPrompt(sessionId, userPrompt);
    const result = await generateCourseBlueprint(sessionId);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.blueprint) setBlueprint(result.blueprint);
    if (result.issues) setIssues(result.issues);
    setStep("preview");
  }

  async function runApply() {
    if (!sessionId) return;
    setBusy(true);
    setError("");
    const result = await applyCourseBlueprint(sessionId);
    setBusy(false);
    if ("error" in result && result.error) {
      setError(result.error);
      return;
    }
    router.push(`/admin/courses/${course.id}/builder?tab=curriculum`);
    router.refresh();
  }

  async function runRework() {
    if (!sessionId || !reworkInstruction.trim()) return;
    setBusy(true);
    setError("");
    const result = await reworkBlueprintSectionAction(
      sessionId,
      reworkInstruction,
      selectedModule ?? undefined,
      selectedItem ?? undefined,
    );
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.blueprint) setBlueprint(result.blueprint);
    if (result.issues) setIssues(result.issues);
    setReworkInstruction("");
  }

  const steps: { id: WizardStep; label: string }[] = [
    { id: "intent", label: "Intent" },
    { id: "sources", label: "Sources" },
    { id: "processing", label: "Process" },
    { id: "generate", label: "Generate" },
    { id: "preview", label: "Preview" },
  ];

  return (
    <div className="max-w-5xl space-y-6">
      <div className="rounded-xl border border-storm-light-blue/50 bg-white p-4 sm:p-6">
        <h2 className="font-title text-lg font-semibold text-storm-navy">AI Studio</h2>
        <p className="mt-1 text-sm text-storm-navy/70">
          Upload training materials or describe what you need. AI drafts a course
          blueprint you can preview before adding it to the curriculum.
        </p>
        <p className="mt-3 rounded-lg bg-storm-light-grey/40 px-3 py-2 text-sm text-storm-navy/70">
          Requires <code className="text-xs">OPENAI_API_KEY</code> on the server for
          generation and transcription.
        </p>
      </div>

      <nav className="flex flex-wrap gap-2">
        {steps.map((s) => (
          <span
            key={s.id}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              step === s.id || (step === "actions" && s.id === "preview")
                ? "bg-storm-medium-blue text-white"
                : "bg-storm-light-grey/60 text-storm-navy/70"
            }`}
          >
            {s.label}
          </span>
        ))}
      </nav>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {step === "intent" && (
        <div className="space-y-4 rounded-xl border bg-white p-4 sm:p-6">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-storm-navy">What to create</legend>
            {(
              [
                ["course", "Full course (new modules)"],
                ["module", "New module in existing course"],
                ["lesson", "Lesson(s) in an existing module"],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="mode"
                  checked={mode === value}
                  onChange={() => setMode(value)}
                />
                {label}
              </label>
            ))}
          </fieldset>

          {mode !== "course" && (
            <label className="block text-sm">
              <span className="font-medium text-storm-navy">Target module</span>
              <select
                className="mt-1 w-full rounded-lg border border-storm-light-blue/60 px-3 py-2"
                value={targetModuleId}
                onChange={(e) => setTargetModuleId(e.target.value)}
                required
              >
                <option value="">Select module…</option>
                {course.modules.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="block text-sm">
            <span className="font-medium text-storm-navy">Instructions (optional)</span>
            <textarea
              className="mt-1 w-full rounded-lg border border-storm-light-blue/60 px-3 py-2"
              rows={4}
              value={userPrompt}
              onChange={(e) => setUserPrompt(e.target.value)}
              placeholder="Tone, audience, topics to emphasize…"
            />
          </label>

          <button
            type="button"
            disabled={busy || (mode !== "course" && !targetModuleId)}
            onClick={startSession}
            className="min-h-11 rounded-lg bg-storm-medium-blue px-6 text-sm font-medium text-white disabled:opacity-50"
          >
            Continue
          </button>
        </div>
      )}

      {step === "sources" && sessionId && (
        <div className="space-y-6 rounded-xl border bg-white p-4 sm:p-6">
          <p className="text-sm text-storm-navy/70">
            For every source, add the material and a short note so the AI knows what it
            is and how to use it (e.g. module intro, reference only, include in quiz).
          </p>

          <label className="block text-sm">
            <span className="font-medium text-storm-navy">
              Note about your next source <span className="text-red-600">*</span>
            </span>
            <textarea
              value={sourceNote}
              onChange={(e) => setSourceNote(e.target.value)}
              rows={2}
              placeholder="What is this and how should it be used in the course?"
              className="mt-1 w-full rounded-lg border border-storm-light-blue/60 px-3 py-2"
            />
          </label>

          <section className="space-y-3 rounded-lg border border-storm-light-blue/40 p-4">
            <h3 className="text-sm font-medium text-storm-navy">Upload files</h3>
            <p className="text-xs text-storm-navy/60">
              PDF, PowerPoint, audio, video, images, or text files
            </p>
            <form onSubmit={handleUpload} className="space-y-3">
              <input
                type="file"
                name="file"
                multiple
                accept=".pdf,.pptx,.ppt,.mp3,.wav,.m4a,.mp4,.mov,.webm,.png,.jpg,.jpeg,.txt,.md"
                className="block w-full text-sm"
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={includeRecording}
                  onChange={(e) => setIncludeRecording(e.target.checked)}
                />
                For uploaded videos: include recording in course (uncheck for transcript
                only)
              </label>
              <button
                type="submit"
                disabled={busy}
                className="min-h-10 rounded-lg border px-4 text-sm font-medium"
              >
                Add file(s)
              </button>
            </form>
          </section>

          <section className="space-y-3 rounded-lg border border-storm-light-blue/40 p-4">
            <h3 className="text-sm font-medium text-storm-navy">Link</h3>
            <p className="text-xs text-storm-navy/60">
              Web articles, documentation, or video URLs (e.g. YouTube)
            </p>
            <div className="flex flex-wrap gap-3 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="urlKind"
                  checked={urlKind === "webpage"}
                  onChange={() => setUrlKind("webpage")}
                />
                Web page / article
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="urlKind"
                  checked={urlKind === "video"}
                  onChange={() => setUrlKind("video")}
                />
                Video link
              </label>
            </div>
            <input
              type="url"
              placeholder="https://…"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              className="min-h-10 w-full rounded-lg border px-3 text-sm"
            />
            {urlKind === "video" && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={includeRecording}
                  onChange={(e) => setIncludeRecording(e.target.checked)}
                />
                Include video in course (uncheck to use transcript/context only)
              </label>
            )}
            <button
              type="button"
              onClick={handleAddUrl}
              disabled={busy || !sourceUrl.trim()}
              className="min-h-10 rounded-lg border px-4 text-sm font-medium"
            >
              Add link
            </button>
          </section>

          <section className="space-y-3 rounded-lg border border-storm-light-blue/40 p-4">
            <h3 className="text-sm font-medium text-storm-navy">Paste text</h3>
            <input
              type="text"
              placeholder="Title (optional)"
              value={pastedTitle}
              onChange={(e) => setPastedTitle(e.target.value)}
              className="min-h-10 w-full rounded-lg border px-3 text-sm"
            />
            <textarea
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              rows={6}
              placeholder="Paste notes, procedures, email copy, etc."
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={handlePasteText}
              disabled={busy || !pastedText.trim()}
              className="min-h-10 rounded-lg border px-4 text-sm font-medium"
            >
              Add pasted text
            </button>
          </section>

          {assets.length > 0 && (
            <ul className="divide-y rounded-lg border text-sm">
              {assets.map((a) => (
                <li key={a.id} className="flex gap-3 px-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-storm-navy">
                      {a.filename ?? a.kind}
                      <span className="ml-2 text-xs font-normal text-storm-navy/50">
                        {a.kind} · {a.processingStatus}
                      </span>
                    </p>
                    {a.placementHint && (
                      <p className="mt-1 text-storm-navy/80">
                        <span className="text-storm-navy/50">Note: </span>
                        {a.placementHint}
                      </p>
                    )}
                    {a.blobUrl && (
                      <p className="mt-0.5 truncate text-xs text-storm-navy/50">
                        {a.blobUrl}
                      </p>
                    )}
                    {a.processingError && (
                      <p className="mt-1 text-red-600">{a.processingError}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    className="shrink-0 text-xs text-red-600"
                    onClick={async () => {
                      await deleteAiSourceAsset(a.id);
                      await pollSession(sessionId);
                    }}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setStep("intent")}
              className="min-h-10 rounded-lg border px-4 text-sm"
            >
              Back
            </button>
            <button
              type="button"
              onClick={runProcessing}
              disabled={busy}
              className="min-h-10 rounded-lg bg-storm-medium-blue px-4 text-sm font-medium text-white"
            >
              Process sources
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("generate");
              }}
              className="min-h-10 rounded-lg border px-4 text-sm text-storm-navy/70"
            >
              Skip processing (text prompt only)
            </button>
          </div>
        </div>
      )}

      {step === "processing" && (
        <div className="rounded-xl border bg-white p-6 text-center text-sm text-storm-navy/70">
          Extracting text and transcribing media… This may take a few minutes.
        </div>
      )}

      {step === "generate" && sessionId && (
        <div className="space-y-4 rounded-xl border bg-white p-4 sm:p-6">
          <label className="block text-sm">
            <span className="font-medium">Refine instructions</span>
            <textarea
              className="mt-1 w-full rounded-lg border px-3 py-2"
              rows={3}
              value={userPrompt}
              onChange={(e) => setUserPrompt(e.target.value)}
            />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={runGenerate}
            className="min-h-11 rounded-lg bg-storm-medium-blue px-6 text-sm font-medium text-white"
          >
            Generate blueprint
          </button>
        </div>
      )}

      {step === "preview" && blueprint && (
        <div className="space-y-4">
          <BlueprintPreview
            blueprint={blueprint}
            issues={issues}
            selectedModule={selectedModule}
            selectedItem={selectedItem}
            onSelectModule={(mi) => {
              setSelectedModule(mi);
              setSelectedItem(null);
            }}
            onSelectItem={(mi, ii) => {
              setSelectedModule(mi);
              setSelectedItem(ii);
            }}
          />

          <div className="rounded-xl border bg-white p-4">
            <label className="block text-sm font-medium">Rework selection</label>
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={reworkInstruction}
                onChange={(e) => setReworkInstruction(e.target.value)}
                placeholder="e.g. Shorten this lesson, add a quiz…"
                className="min-h-10 flex-1 rounded-lg border px-3 text-sm"
              />
              <button
                type="button"
                disabled={busy || !reworkInstruction.trim()}
                onClick={runRework}
                className="min-h-10 shrink-0 rounded-lg border px-4 text-sm font-medium"
              >
                Rework
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || issues.some((i) => i.level === "error")}
              onClick={runApply}
              className="min-h-11 rounded-lg bg-storm-medium-blue px-6 text-sm font-medium text-white disabled:opacity-50"
            >
              Apply to course
            </button>
            <button
              type="button"
              onClick={() => setStep("generate")}
              className="min-h-11 rounded-lg border px-4 text-sm"
            >
              Regenerate
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
