"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { CourseBuilderCourse } from "@/lib/course-builder/types";
import type { CourseBlueprint } from "@/lib/ai/blueprint-schema";
import type { BlueprintIssue } from "@/lib/ai/validate-blueprint";
import {
  applyCourseBlueprint,
  approveStructureAndGenerateContent,
  createAiSession,
  generateCourseStructure,
  generateNextBlueprintItem,
  processAiSession,
  reworkBlueprintSectionAction,
  updateAiSessionPrompt,
  uploadAiSource,
  deleteAiSourceAsset,
} from "@/lib/actions/ai-builder";
import { BlueprintPreview } from "../ai/BlueprintPreview";
import { AiLoadingSpinner } from "../ai/AiLoadingSpinner";

type WizardStep =
  | "intent"
  | "sources"
  | "processing"
  | "generate"
  | "structure_preview"
  | "generating_content"
  | "preview";

type PendingFile = {
  id: string;
  file: File;
  note: string;
};

export function AiStudioTab({ course }: { course: CourseBuilderCourse }) {
  const router = useRouter();
  const [step, setStep] = useState<WizardStep>("intent");
  const [mode, setMode] = useState<"course" | "module" | "lesson">("course");
  const [targetModuleId, setTargetModuleId] = useState("");
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
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [fileIncludeRecording, setFileIncludeRecording] = useState(true);
  const [urlNote, setUrlNote] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [urlKind, setUrlKind] = useState<"webpage" | "video">("webpage");
  const [urlIncludeRecording, setUrlIncludeRecording] = useState(true);
  const [pasteTitle, setPasteTitle] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [pasteNote, setPasteNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [blueprint, setBlueprint] = useState<CourseBlueprint | null>(null);
  const [issues, setIssues] = useState<BlueprintIssue[]>([]);
  const [selectedModule, setSelectedModule] = useState<number | null>(0);
  const [selectedItem, setSelectedItem] = useState<number | null>(null);
  const [reworkInstruction, setReworkInstruction] = useState("");
  const [contentProgress, setContentProgress] = useState<{
    current: number;
    total: number;
    label?: string;
  } | null>(null);
  const contentGenStarted = useRef(false);

  const pollSession = useCallback(async (id: string) => {
    const res = await fetch(`/api/admin/ai-sessions/${id}`);
    if (!res.ok) return;
    const data = await res.json();
    setAssets(data.assets ?? []);
    if (data.blueprintJson) {
      setBlueprint(data.blueprintJson as CourseBlueprint);
    }
    if (data.status === "structure_ready") setStep("structure_preview");
    if (data.status === "ready") setStep("preview");
    if (data.status === "failed" && data.error) setError(data.error);
  }, []);

  useEffect(() => {
    if (!sessionId || step !== "processing") return;
    const t = setInterval(() => pollSession(sessionId), 3000);
    return () => clearInterval(t);
  }, [sessionId, step, pollSession]);

  useEffect(() => {
    if (step !== "generating_content" || !sessionId) return;
    if (contentGenStarted.current) return;
    contentGenStarted.current = true;

    let cancelled = false;

    async function runContentGeneration() {
      setBusy(true);
      setError("");
      while (!cancelled) {
        const result = await generateNextBlueprintItem(sessionId!);
        if (result.error) {
          setError(result.error);
          break;
        }
        if (result.blueprint) setBlueprint(result.blueprint);
        if (result.progress) setContentProgress(result.progress);
        if (result.done) {
          setStep("preview");
          break;
        }
      }
      setBusy(false);
      contentGenStarted.current = false;
    }

    void runContentGeneration();
    return () => {
      cancelled = true;
    };
  }, [step, sessionId]);

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

  async function postSource(fd: FormData) {
    if (!sessionId) return false;
    const result = await uploadAiSource(sessionId, fd);
    if (result.error) {
      setError(result.error);
      return false;
    }
    return true;
  }

  function onFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const list = e.target.files;
    if (!list?.length) return;
    const added: PendingFile[] = [];
    for (let i = 0; i < list.length; i++) {
      added.push({
        id: `${Date.now()}-${i}-${list[i].name}`,
        file: list[i],
        note: "",
      });
    }
    setPendingFiles((prev) => [...prev, ...added]);
    e.target.value = "";
  }

  function updatePendingNote(id: string, note: string) {
    setPendingFiles((prev) =>
      prev.map((p) => (p.id === id ? { ...p, note } : p)),
    );
  }

  async function uploadPendingFiles() {
    if (!sessionId || pendingFiles.length === 0) return;
    const missing = pendingFiles.filter((p) => !p.note.trim());
    if (missing.length) {
      setError("Add a note for each file before uploading.");
      return;
    }
    setBusy(true);
    setError("");
    let ok = true;
    for (const p of pendingFiles) {
      const fd = new FormData();
      fd.set("file", p.file);
      fd.set("sourceNote", p.note.trim());
      fd.set("includeRecording", fileIncludeRecording ? "true" : "false");
      if (!(await postSource(fd))) {
        ok = false;
        break;
      }
    }
    setBusy(false);
    if (ok) {
      setPendingFiles([]);
      await pollSession(sessionId);
    }
  }

  async function handleAddUrl() {
    if (!sessionId) return;
    if (!urlNote.trim()) {
      setError("Add a note describing this link.");
      return;
    }
    if (!sourceUrl.trim()) {
      setError("Enter a URL.");
      return;
    }
    setBusy(true);
    setError("");
    const fd = new FormData();
    fd.set("sourceUrl", sourceUrl.trim());
    fd.set("sourceNote", urlNote.trim());
    fd.set("urlKind", urlKind);
    fd.set("includeRecording", urlIncludeRecording ? "true" : "false");
    const ok = await postSource(fd);
    setBusy(false);
    if (ok) {
      setSourceUrl("");
      setUrlNote("");
      await pollSession(sessionId);
    }
  }

  async function handlePasteText() {
    if (!sessionId) return;
    if (!pasteNote.trim()) {
      setError("Add a note describing this pasted text.");
      return;
    }
    if (!pasteText.trim()) {
      setError("Paste some text to add as a source.");
      return;
    }
    setBusy(true);
    setError("");
    const fd = new FormData();
    fd.set("pastedText", pasteText.trim());
    fd.set("sourceNote", pasteNote.trim());
    if (pasteTitle.trim()) fd.set("pastedTitle", pasteTitle.trim());
    const ok = await postSource(fd);
    setBusy(false);
    if (ok) {
      setPasteText("");
      setPasteTitle("");
      setPasteNote("");
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

  async function runGenerateStructure() {
    if (!sessionId) return;
    setBusy(true);
    setError("");
    await updateAiSessionPrompt(sessionId, userPrompt);
    const result = await generateCourseStructure(sessionId);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.blueprint) setBlueprint(result.blueprint);
    if (result.issues) setIssues(result.issues);
    setStep("structure_preview");
  }

  async function runApproveAndGenerateContent() {
    if (!sessionId) return;
    setBusy(true);
    setError("");
    const approve = await approveStructureAndGenerateContent(sessionId);
    if (approve.error) {
      setBusy(false);
      setError(approve.error);
      return;
    }
    setBusy(false);
    contentGenStarted.current = false;
    setContentProgress({ current: 0, total: flattenTotal(blueprint) });
    setStep("generating_content");
  }

  function flattenTotal(bp: CourseBlueprint | null) {
    if (!bp) return 0;
    return bp.modules.reduce((n, m) => n + m.items.length, 0);
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
    { id: "generate", label: "Structure" },
    { id: "structure_preview", label: "Review structure" },
    { id: "generating_content", label: "Write content" },
    { id: "preview", label: "Preview" },
  ];

  const showSpinner =
    busy ||
    step === "processing" ||
    step === "generating_content";

  return (
    <div className="relative max-w-5xl space-y-6">
      {showSpinner && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/80">
          <AiLoadingSpinner
            label={
              step === "processing"
                ? "Processing sources…"
                : step === "generating_content" && contentProgress
                  ? `Writing content (${contentProgress.current} of ${contentProgress.total})${contentProgress.label ? `: ${contentProgress.label}` : ""}`
                  : "AI is working…"
            }
          />
        </div>
      )}

      <div className="rounded-xl border border-storm-light-blue/50 bg-white p-4 sm:p-6">
        <h2 className="font-title text-lg font-semibold text-storm-navy">AI Studio</h2>
        <p className="mt-1 text-sm text-storm-navy/70">
          Add sources with notes, generate the course outline first, then generate
          full content for each lesson, video, and quiz one at a time.
        </p>
      </div>

      <nav className="flex flex-wrap gap-2">
        {steps.map((s) => (
          <span
            key={s.id}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              step === s.id
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
            Add as many sources as you need. Each file, link, or pasted text must
            include its own note.
          </p>

          <section className="space-y-3 rounded-lg border border-storm-light-blue/40 p-4">
            <h3 className="text-sm font-medium text-storm-navy">Files</h3>
            <p className="text-xs text-storm-navy/60">
              Select one or more files, add a note for each, then upload.
            </p>
            <input
              type="file"
              multiple
              accept=".pdf,.pptx,.ppt,.mp3,.wav,.m4a,.mp4,.mov,.webm,.png,.jpg,.jpeg,.txt,.md"
              onChange={onFilesSelected}
              className="block w-full text-sm"
            />
            {pendingFiles.length > 0 && (
              <ul className="space-y-3">
                {pendingFiles.map((p) => (
                  <li
                    key={p.id}
                    className="rounded-lg border border-storm-light-blue/40 p-3"
                  >
                    <p className="text-sm font-medium text-storm-navy">{p.file.name}</p>
                    <textarea
                      value={p.note}
                      onChange={(e) => updatePendingNote(p.id, e.target.value)}
                      rows={2}
                      placeholder="Note for this file (required)"
                      className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      className="mt-2 text-xs text-red-600"
                      onClick={() =>
                        setPendingFiles((prev) => prev.filter((x) => x.id !== p.id))
                      }
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={fileIncludeRecording}
                onChange={(e) => setFileIncludeRecording(e.target.checked)}
              />
              For video files: include recording in course
            </label>
            <button
              type="button"
              disabled={busy || pendingFiles.length === 0}
              onClick={uploadPendingFiles}
              className="min-h-10 rounded-lg border px-4 text-sm font-medium"
            >
              Upload {pendingFiles.length > 0 ? `${pendingFiles.length} file(s)` : ""}
            </button>
          </section>

          <section className="space-y-3 rounded-lg border border-storm-light-blue/40 p-4">
            <h3 className="text-sm font-medium text-storm-navy">Link</h3>
            <textarea
              value={urlNote}
              onChange={(e) => setUrlNote(e.target.value)}
              rows={2}
              placeholder="Note for this link (required)"
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
            <div className="flex flex-wrap gap-3 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={urlKind === "webpage"}
                  onChange={() => setUrlKind("webpage")}
                />
                Web page / article
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
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
                  checked={urlIncludeRecording}
                  onChange={(e) => setUrlIncludeRecording(e.target.checked)}
                />
                Include video in course
              </label>
            )}
            <button
              type="button"
              onClick={handleAddUrl}
              disabled={busy}
              className="min-h-10 rounded-lg border px-4 text-sm font-medium"
            >
              Add link
            </button>
          </section>

          <section className="space-y-3 rounded-lg border border-storm-light-blue/40 p-4">
            <h3 className="text-sm font-medium text-storm-navy">Paste text</h3>
            <textarea
              value={pasteNote}
              onChange={(e) => setPasteNote(e.target.value)}
              rows={2}
              placeholder="Note for this text (required)"
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
            <input
              type="text"
              placeholder="Title (optional)"
              value={pasteTitle}
              onChange={(e) => setPasteTitle(e.target.value)}
              className="min-h-10 w-full rounded-lg border px-3 text-sm"
            />
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              rows={6}
              placeholder="Paste notes, procedures, etc."
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={handlePasteText}
              disabled={busy}
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
              onClick={() => setStep("generate")}
              className="min-h-10 rounded-lg border px-4 text-sm text-storm-navy/70"
            >
              Skip processing
            </button>
          </div>
        </div>
      )}

      {step === "processing" && (
        <div className="rounded-xl border bg-white p-4">
          <AiLoadingSpinner label="Extracting text and transcribing media…" />
        </div>
      )}

      {step === "generate" && sessionId && (
        <div className="space-y-4 rounded-xl border bg-white p-4 sm:p-6">
          <p className="text-sm text-storm-navy/70">
            Step 1: AI creates modules and items with titles and outlines only — no
            full lesson or quiz content yet.
          </p>
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
            onClick={runGenerateStructure}
            className="min-h-11 rounded-lg bg-storm-medium-blue px-6 text-sm font-medium text-white"
          >
            Generate course structure
          </button>
        </div>
      )}

      {step === "structure_preview" && blueprint && (
        <div className="space-y-4">
          <p className="text-sm text-storm-navy/70">
            Review the outline below. When you approve, AI will write each item&apos;s
            full content one at a time.
          </p>
          <BlueprintPreview
            blueprint={blueprint}
            issues={issues}
            structureOnly
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
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={runApproveAndGenerateContent}
              className="min-h-11 rounded-lg bg-storm-medium-blue px-6 text-sm font-medium text-white"
            >
              Approve structure & generate content
            </button>
            <button
              type="button"
              onClick={() => setStep("generate")}
              className="min-h-11 rounded-lg border px-4 text-sm"
            >
              Regenerate structure
            </button>
          </div>
        </div>
      )}

      {step === "generating_content" && (
        <div className="rounded-xl border bg-white p-4">
          <AiLoadingSpinner
            label={
              contentProgress
                ? `Writing item ${contentProgress.current} of ${contentProgress.total}${contentProgress.label ? ` — ${contentProgress.label}` : ""}`
                : "Generating content…"
            }
          />
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
          </div>
        </div>
      )}
    </div>
  );
}
