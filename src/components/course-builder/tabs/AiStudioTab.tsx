"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { AiSessionStatus } from "@prisma/client";
import type { CourseBuilderCourse } from "@/lib/course-builder/types";
import type { CourseBlueprint } from "@/lib/ai/blueprint-schema";
import type { BlueprintIssue } from "@/lib/ai/validate-blueprint";
import {
  applyCourseBlueprint,
  approveStructureAndGenerateContent,
  resumeContentGeneration,
  cancelAiGenerationSession,
  createAiSession,
  generateCourseStructure,
  generateNextBlueprintItem,
  retryBlueprintItemContent,
  processAiSession,
  reworkBlueprintSectionAction,
  updateAiSessionPrompt,
  updateAiSessionAllowedItemTypes,
  updateAiSessionDiscoverYoutube,
  updateAiSessionDiscoverImages,
  discardAiSessionDraft,
  uploadAiSource,
  deleteAiSourceAsset,
  attachLibraryAssetsToSession,
} from "@/lib/actions/ai-builder";
import { LibraryPicker } from "@/components/library/LibraryPicker";
import {
  DEFAULT_ALLOWED_ITEM_TYPES,
  parseAllowedItemTypes,
  type BlueprintItemType,
} from "@/lib/ai/allowed-item-types";
import { BlueprintPreview } from "../ai/BlueprintPreview";
import { AiLoadingView, AiLoadingSpinner } from "../ai/AiLoadingView";
import {
  activateAiStep,
  completeAiStep,
  createAiProgress,
  finishAiProgress,
  patchAiProgress,
  progressDetailForProcessingAssets,
  type AiOperationProgress,
} from "@/lib/ai/ai-operation-progress";
import { getAiStudioLoadingMessage, formatContentGenerationEstimate } from "@/lib/ai/ai-loading-estimates";
import { ItemTypePicker } from "../ai/ItemTypePicker";
import { FileInput } from "@/components/ui/FileInput";
import { YouTubeIframe } from "@/components/video/YouTubeIframe";
import { isYouTubeUrl } from "@/lib/video/youtube";
import { validateBlueprint } from "@/lib/ai/validate-blueprint";
import {
  sessionStatusLabel,
  wizardStepFromSessionStatus,
  type AiStudioWizardStep,
} from "@/lib/ai/session-restore";
import { useCourseBuilderUnsaved } from "../CourseBuilderUnsavedContext";
import { Square } from "lucide-react";

type SessionApiPayload = {
  id: string;
  status: AiSessionStatus;
  mode?: "course" | "module" | "lesson";
  targetModuleId?: string | null;
  userPrompt?: string | null;
  error?: string | null;
  allowedItemTypes?: unknown;
  discoverYoutubeVideos?: boolean;
  discoverImages?: boolean;
  blueprintJson?: unknown;
  contentItemCursor?: number;
  structureApproved?: boolean;
  assets?: {
    id: string;
    kind: string;
    filename: string | null;
    processingStatus: string;
    processingError: string | null;
    placementHint: string | null;
    blobUrl: string | null;
  }[];
};

function formatSkippedItemWarning(item: {
  title: string;
  moduleTitle: string;
  reason?: string;
}): string {
  const base = `"${item.title}" (${item.moduleTitle})`;
  if (item.reason?.trim()) {
    const short =
      item.reason.length > 280 ? `${item.reason.slice(0, 280)}…` : item.reason;
    return `${base}: ${short}`;
  }
  return `${base}: validation failed after multiple attempts — fill in manually in the course builder.`;
}

function warningsFromBlueprint(blueprint: CourseBlueprint): string[] {
  return (blueprint.generationSkippedItems ?? []).map((s) =>
    formatSkippedItemWarning({
      title: s.title,
      moduleTitle: s.moduleTitle,
      reason: s.reason,
    }),
  );
}

function isBlueprintItemSkipped(
  blueprint: CourseBlueprint,
  moduleIndex: number,
  itemIndex: number,
): boolean {
  return (blueprint.generationSkippedItems ?? []).some(
    (s) => s.moduleIndex === moduleIndex && s.itemIndex === itemIndex,
  );
}

function assetsNeedProcessing(
  assets: { processingStatus: string; kind: string }[],
): boolean {
  return assets.some(
    (a) =>
      (a.processingStatus === "pending" || a.processingStatus === "failed") &&
      (a.kind === "pdf" ||
        a.kind === "pptx" ||
        a.kind === "video" ||
        a.kind === "audio" ||
        a.kind === "webpage"),
  );
}

type WizardStep = AiStudioWizardStep;

type PendingFile = {
  id: string;
  file: File;
  note: string;
};

export function AiStudioTab({ course }: { course: CourseBuilderCourse }) {
  const router = useRouter();
  const pathname = usePathname();
  const { setDirty, registerSave, unregister } = useCourseBuilderUnsaved();
  const [step, setStep] = useState<WizardStep>("intent");
  const [mode, setMode] = useState<"course" | "module" | "lesson">("course");
  const [targetModuleId, setTargetModuleId] = useState("");
  const [userPrompt, setUserPrompt] = useState("");
  const [allowedItemTypes, setAllowedItemTypes] = useState<BlueprintItemType[]>([
    ...DEFAULT_ALLOWED_ITEM_TYPES,
  ]);
  const [discoverYoutubeVideos, setDiscoverYoutubeVideos] = useState(false);
  const [discoverImages, setDiscoverImages] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState<AiSessionStatus | null>(null);
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
  const [librarySelectedIds, setLibrarySelectedIds] = useState<string[]>([]);
  const [librarySelectedTagIds, setLibrarySelectedTagIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [blueprint, setBlueprint] = useState<CourseBlueprint | null>(null);
  const [issues, setIssues] = useState<BlueprintIssue[]>([]);
  const [selectedModule, setSelectedModule] = useState<number | null>(0);
  const [selectedItem, setSelectedItem] = useState<number | null>(null);
  const [reworkInstruction, setReworkInstruction] = useState("");
  const [retryingItem, setRetryingItem] = useState<{
    moduleIndex: number;
    itemIndex: number;
  } | null>(null);
  const [aiProgress, setAiProgress] = useState<AiOperationProgress | null>(null);
  const [contentProgress, setContentProgress] = useState<{
    current: number;
    total: number;
    label?: string;
  } | null>(null);
  const [contentItemCursor, setContentItemCursor] = useState(0);
  const [structureApproved, setStructureApproved] = useState(false);
  const [generationWarnings, setGenerationWarnings] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [stopping, setStopping] = useState(false);
  const contentGenStarted = useRef(false);
  const contentGenCancelledRef = useRef(false);
  const stopRequestedRef = useRef(false);
  const retryOpRef = useRef(0);
  const draftRestored = useRef(false);

  const applySessionData = useCallback(
    (data: SessionApiPayload, options?: { restoreStep?: boolean; notice?: string }) => {
      setSessionId(data.id);
      setSessionStatus(data.status);
      if (data.mode) setMode(data.mode);
      if (data.targetModuleId) setTargetModuleId(data.targetModuleId);
      if (data.userPrompt != null) setUserPrompt(data.userPrompt);
      setAssets(data.assets ?? []);
      if (data.allowedItemTypes) {
        setAllowedItemTypes(parseAllowedItemTypes(data.allowedItemTypes));
      }
      if (typeof data.discoverYoutubeVideos === "boolean") {
        setDiscoverYoutubeVideos(data.discoverYoutubeVideos);
      }
      if (typeof data.discoverImages === "boolean") {
        setDiscoverImages(data.discoverImages);
      }
      if (typeof data.contentItemCursor === "number") {
        setContentItemCursor(data.contentItemCursor);
      }
      if (typeof data.structureApproved === "boolean") {
        setStructureApproved(data.structureApproved);
      }
      if (data.blueprintJson) {
        const bp = data.blueprintJson as CourseBlueprint;
        setBlueprint(bp);
        if (data.status === "ready" || data.status === "generating_content") {
          setGenerationWarnings(warningsFromBlueprint(bp));
        }
      }
      if (options?.restoreStep !== false) {
        const nextStep = wizardStepFromSessionStatus(data.status, {
          hasAssets: (data.assets?.length ?? 0) > 0,
          hasBlueprint: !!data.blueprintJson,
        });
        setStep(nextStep as WizardStep);
      }
      if (data.status === "failed" && data.error) {
        setError(data.error);
      }
      if (options?.notice) {
        setNotice(options.notice);
      }
    },
    [],
  );

  const pollSession = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/admin/ai-sessions/${id}`);
      if (!res.ok) return;
      const data = (await res.json()) as SessionApiPayload;
      applySessionData(data);
    },
    [applySessionData],
  );

  useEffect(() => {
    if (draftRestored.current) return;
    draftRestored.current = true;

    async function loadActiveDraft() {
      try {
        const res = await fetch(`/api/admin/courses/${course.id}/ai-session`);
        if (!res.ok) return;
        const data = (await res.json()) as { session: SessionApiPayload | null };
        if (!data.session) return;
        applySessionData(data.session, {
          notice: `Resumed your saved AI draft (${sessionStatusLabel(data.session.status)}). Continue where you left off.`,
        });
      } catch {
        // ignore — user can start fresh
      }
    }

    void loadActiveDraft();
  }, [course.id, applySessionData]);

  useEffect(() => {
    const active =
      !!sessionId && sessionStatus !== null && sessionStatus !== "applied";
    if (!active) {
      unregister("ai-studio");
      return;
    }
    registerSave("ai-studio", async () => true);
    setDirty("ai-studio", true);
    return () => unregister("ai-studio");
  }, [sessionId, sessionStatus, registerSave, setDirty, unregister]);

  useEffect(() => {
    if (!sessionId || step !== "processing") return;
    const t = setInterval(() => pollSession(sessionId), 3000);
    return () => clearInterval(t);
  }, [sessionId, step, pollSession]);

  useEffect(() => {
    if (step !== "processing" || !aiProgress) return;
    const { detail, activeStepId } = progressDetailForProcessingAssets(assets);
    setAiProgress((prev) => {
      if (!prev) return prev;
      const next = patchAiProgress(prev, { detail });
      return activateAiStep(next, activeStepId, detail);
    });
  }, [assets, step, aiProgress?.startedAt]);

  useEffect(() => {
    if (step !== "generating_content" || !sessionId) return;
    if (contentGenStarted.current) return;
    contentGenStarted.current = true;
    contentGenCancelledRef.current = false;

    async function runContentGeneration() {
      setBusy(true);
      setError("");
      setNotice("");
      setGenerationWarnings([]);
      const total = flattenTotal(blueprint);
      setAiProgress(
        createAiProgress(
          "Writing course content",
          [
            { id: "prepare", label: "Prepare items and media links" },
            { id: "write", label: "AI writes each lesson, quiz, and video" },
            { id: "save", label: "Save progress to your draft" },
          ],
          total > 0 ? `Starting item 1 of ${total}…` : "Starting content generation…",
          total > 0
            ? formatContentGenerationEstimate(0, total)
            : "About 30–90 seconds per item",
        ),
      );
      try {
        let itemNum = 0;
        while (!contentGenCancelledRef.current) {
          setAiProgress((prev) =>
            prev
              ? patchAiProgress(activateAiStep(prev, "write", `Calling AI for item ${itemNum + 1}${total ? ` of ${total}` : ""}…`), {
                  steps: prev.steps.map((s) =>
                    s.id === "write"
                      ? {
                          ...s,
                          label:
                            total > 0
                              ? `Writing item ${itemNum + 1} of ${total}`
                              : "AI writes each lesson, quiz, and video",
                        }
                      : s.id === "prepare"
                        ? { ...s, status: "done" as const }
                        : s,
                  ),
                })
              : prev,
          );

          const result = await generateNextBlueprintItem(sessionId!);
          itemNum += 1;

          if (contentGenCancelledRef.current || result.cancelled) {
            break;
          }
          if (result.error) {
            setError(result.error);
            break;
          }
          if (result.blueprint) {
            setBlueprint(result.blueprint);
            if (result.skippedItem) {
              setGenerationWarnings((prev) => {
                const next = [
                  ...prev,
                  formatSkippedItemWarning(result.skippedItem!),
                ];
                return [...new Set(next)];
              });
            }
          }
          if (result.progress) {
            setContentProgress(result.progress);
            setContentItemCursor(result.progress.current);
            const cur = result.progress.current;
            const tot = result.progress.total;
            setAiProgress((prev) =>
              prev
                ? patchAiProgress(prev, {
                    detail: result.progress!.label
                      ? `Finished ${result.progress!.label} — ${cur} of ${tot} done`
                      : `Finished item ${cur} of ${tot}`,
                    timeEstimate: formatContentGenerationEstimate(cur, tot),
                    steps: prev.steps.map((s) =>
                      s.id === "write"
                        ? {
                            ...s,
                            label: `Writing item ${Math.min(cur + 1, tot)} of ${tot}`,
                          }
                        : s,
                    ),
                  })
                : prev,
            );
          }
          if (result.done) {
            setAiProgress((prev) =>
              prev
                ? finishAiProgress(
                    activateAiStep(prev, "save", "Saving draft…"),
                    "Content generation complete",
                  )
                : prev,
            );
            const finalBp = result.blueprint ?? blueprint;
            if (finalBp) {
              setContentItemCursor(flattenTotal(finalBp));
              setGenerationWarnings(warningsFromBlueprint(finalBp));
              const skipCount = finalBp.generationSkippedItems?.length ?? 0;
              if (skipCount > 0) {
                setNotice(
                  `Finished writing content. ${skipCount} item${skipCount === 1 ? "" : "s"} could not be completed — review the list below for reasons.`,
                );
              } else {
                setNotice(
                  "All items were generated successfully. Review the preview, then apply to your course.",
                );
              }
            }
            setStep("preview");
            break;
          }
        }
      } finally {
        setBusy(false);
        setAiProgress(null);
        contentGenStarted.current = false;
      }
    }

    void runContentGeneration();
    return () => {
      contentGenCancelledRef.current = true;
      contentGenStarted.current = false;
    };
  }, [step, sessionId]);

  function confirmStopGeneration(): boolean {
    if (step === "generating_content") {
      return window.confirm(
        "Stop writing content?\n\nItems already written will be kept. You can continue generating the rest later.",
      );
    }
    if (step === "preview" && busy) {
      return window.confirm(
        "Stop this AI request?\n\nChanges from the in-flight request will be discarded.",
      );
    }
    if (step === "preview" && retryingItem) {
      return window.confirm("Stop retrying this item?");
    }
    if (step === "processing") {
      return window.confirm(
        "Stop processing sources?\n\nProcessing may continue in the background, but you can leave this step now.",
      );
    }
    return window.confirm(
      "Stop AI generation?\n\nIf the outline has not finished, it will not be saved.",
    );
  }

  async function handleStopGeneration() {
    if (!sessionId || stopping || !confirmStopGeneration()) return;

    if (step === "preview" && retryingItem) {
      retryOpRef.current += 1;
      setRetryingItem(null);
      setAiProgress(null);
      setNotice("Try again stopped.");
      return;
    }

    setStopping(true);
    stopRequestedRef.current = true;
    contentGenCancelledRef.current = true;
    setAiProgress(null);

    const result = await cancelAiGenerationSession(sessionId);
    setStopping(false);

    if (step === "preview") {
      setBusy(false);
    }

    if (result.error) {
      setError(result.error);
      return;
    }

    if (result.stopped) {
      setBusy(false);
      contentGenStarted.current = false;
      await pollSession(sessionId);

      if (result.nextStep === "preview") {
        setStep("preview");
        setNotice(
          step === "preview"
            ? "Request stopped. Changes from that request were discarded."
            : "Content generation stopped. Review what was written below, or continue generating remaining items.",
        );
      } else if (result.nextStep === "generate") {
        setStep("generate");
        setNotice("Structure generation stopped.");
      } else {
        setStep("sources");
        setNotice("Processing stopped.");
      }
    }
  }

  async function startSession() {
    if (allowedItemTypes.length === 0) {
      setError("Select at least one content type.");
      return;
    }
    if (sessionId && sessionStatus !== "applied") {
      const ok = window.confirm(
        "Starting a new AI session will discard your current saved draft. Continue?",
      );
      if (!ok) return;
      await discardAiSessionDraft(sessionId);
      setSessionId(null);
      setSessionStatus(null);
      setBlueprint(null);
      setGenerationWarnings([]);
    }
    setBusy(true);
    setError("");
    try {
      const result = await createAiSession(course.id, mode, {
        targetModuleId:
          mode !== "course" && targetModuleId ? targetModuleId : undefined,
        userPrompt,
        allowedItemTypes,
        discoverYoutubeVideos:
          discoverYoutubeVideos && allowedItemTypes.includes("VIDEO"),
        discoverImages: discoverImages && allowedItemTypes.includes("LESSON"),
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      if (!result.session) {
        setError("Could not create session.");
        return;
      }
      setSessionId(result.session.id);
      setSessionStatus(result.session.status);
      setAssets(result.session.assets ?? []);
      setStep("sources");
    } finally {
      setBusy(false);
    }
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
    try {
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
      if (ok) {
        setPendingFiles([]);
        await pollSession(sessionId);
      }
    } finally {
      setBusy(false);
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

  async function skipProcessing() {
    if (assetsNeedProcessing(assets)) {
      const ok = window.confirm(
        "Skip processing?\n\nPDFs, videos, and web pages work much better after processing. Without it, AI often fails to write videos and detailed lessons.",
      );
      if (!ok) return;
    }
    setStep("generate");
  }

  async function runProcessing() {
    if (!sessionId) return;
    stopRequestedRef.current = false;
    setStep("processing");
    setBusy(true);
    setError("");
    setNotice("");
    setAiProgress(
      createAiProgress(
        "Processing sources",
        [
          { id: "extract", label: "Extract text from PDFs and documents" },
          { id: "transcribe", label: "Transcribe audio and video" },
          { id: "summarize", label: "Summarize sources for AI" },
          { id: "finish", label: "Finish processing" },
        ],
        "Starting source processing…",
        "Usually 1–5 minutes depending on file size and count",
      ),
    );
    try {
      const result = await processAiSession(sessionId);
      if (stopRequestedRef.current || result.cancelled) {
        return;
      }
      if (result.error) {
        setError(result.error);
        return;
      }
      setAiProgress((prev) =>
        prev
          ? finishAiProgress(prev, "Processing complete — opening structure step…")
          : prev,
      );
      await pollSession(sessionId);
      setStep("generate");
    } finally {
      setBusy(false);
      setAiProgress(null);
    }
  }

  async function runGenerateStructure() {
    if (!sessionId) return;
    if (allowedItemTypes.length === 0) {
      setError("Select at least one content type.");
      return;
    }
    stopRequestedRef.current = false;
    setBusy(true);
    setError("");
    setNotice("");
    setAiProgress(
      createAiProgress(
        "Generating course structure",
        [
          { id: "settings", label: "Save settings and source summaries" },
          { id: "ai", label: "AI designs modules and items" },
          { id: "validate", label: "Validate outline" },
        ],
        "Saving your settings…",
        "Usually about 1–2 minutes",
      ),
    );
    try {
      await updateAiSessionPrompt(sessionId, userPrompt);
      await updateAiSessionDiscoverYoutube(
        sessionId,
        discoverYoutubeVideos && allowedItemTypes.includes("VIDEO"),
      );
      await updateAiSessionDiscoverImages(
        sessionId,
        discoverImages && allowedItemTypes.includes("LESSON"),
      );
      const typesResult = await updateAiSessionAllowedItemTypes(
        sessionId,
        allowedItemTypes,
      );
      if (typesResult.error) {
        setError(typesResult.error);
        return;
      }
      setAiProgress((prev) =>
        prev
          ? activateAiStep(
              prev,
              "ai",
              "Waiting for AI to design modules and items…",
            )
          : prev,
      );
      const result = await generateCourseStructure(sessionId);
      if (stopRequestedRef.current || result.cancelled) {
        return;
      }
      if (result.error) {
        setError(result.error);
        return;
      }
      setAiProgress((prev) =>
        prev
          ? finishAiProgress(
              completeAiStep(prev, "validate", "Outline ready"),
              "Structure complete",
            )
          : prev,
      );
      if (result.blueprint) setBlueprint(result.blueprint);
      if (result.issues) setIssues(result.issues);
      setStep("structure_preview");
    } finally {
      setBusy(false);
      setAiProgress(null);
    }
  }

  async function runApproveAndGenerateContent() {
    if (!sessionId) return;
    stopRequestedRef.current = false;
    contentGenCancelledRef.current = false;
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

  async function runContinueContentGeneration() {
    if (!sessionId) return;
    stopRequestedRef.current = false;
    contentGenCancelledRef.current = false;
    setBusy(true);
    setError("");
    const result = await resumeContentGeneration(sessionId);
    if (result.error) {
      setBusy(false);
      setError(result.error);
      return;
    }
    if (result.progress) {
      setContentProgress(result.progress);
    }
    setBusy(false);
    contentGenStarted.current = false;
    setNotice("");
    setStep("generating_content");
  }

  function flattenTotal(bp: CourseBlueprint | null) {
    if (!bp) return 0;
    return bp.modules.reduce((n, m) => n + m.items.length, 0);
  }

  function saveDraftAndLeave() {
    unregister("ai-studio");
    router.push(`${pathname}?tab=curriculum`);
  }

  async function runRetryItem(moduleIndex: number, itemIndex: number) {
    if (!sessionId) return;
    const opId = ++retryOpRef.current;
    setRetryingItem({ moduleIndex, itemIndex });
    setError("");
    setNotice("");
    const itemLabel =
      blueprint?.modules[moduleIndex]?.items[itemIndex]?.title ?? "item";
    setAiProgress(
      createAiProgress(
        "Retrying item",
        [
          { id: "prepare", label: "Reset item and prepare context" },
          { id: "ai", label: "AI rewrites content" },
          { id: "save", label: "Validate and save draft" },
        ],
        `Preparing "${itemLabel}"…`,
        "Usually 30–90 seconds",
      ),
    );
    try {
      setAiProgress((prev) =>
        prev
          ? activateAiStep(prev, "ai", `Waiting for AI to rewrite "${itemLabel}"…`)
          : prev,
      );
      const result = await retryBlueprintItemContent(sessionId, moduleIndex, itemIndex);
      if (opId !== retryOpRef.current) return;

      if ("error" in result && result.error && !("blueprint" in result)) {
        setError(result.error);
        setNotice("Try again failed — see the error above.");
        return;
      }

      if ("blueprint" in result && result.blueprint) {
        setBlueprint(result.blueprint);
        setIssues(validateBlueprint(result.blueprint).issues);
        setGenerationWarnings(warningsFromBlueprint(result.blueprint));

        if ("ok" in result && result.ok && "message" in result && result.message) {
          setAiProgress((prev) =>
            prev ? finishAiProgress(prev, result.message!) : prev,
          );
          setNotice(result.message);
          setError("");
          return;
        }

        const failReason =
          ("error" in result && result.error) ||
          ("skippedItem" in result && result.skippedItem?.reason) ||
          "Generation failed again.";
        setError(failReason);
        setNotice("Try again did not finish this item — see the error above.");
      }
    } finally {
      if (opId === retryOpRef.current) {
        setRetryingItem(null);
        setAiProgress(null);
      }
    }
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
    unregister("ai-studio");
    setSessionStatus("applied");
    router.push(`/admin/courses/${course.id}/builder?tab=curriculum`);
    router.refresh();
  }

  async function runRework() {
    if (!sessionId || !reworkInstruction.trim()) return;

    if (selectedModule === null) {
      setError("Select a module and item in the structure list before reworking.");
      return;
    }

    if (selectedItem === null) {
      const mod = blueprint?.modules[selectedModule];
      const ok = window.confirm(
        `No specific item is selected — only the module "${mod?.title ?? "Module"}".\n\nRework will revise the entire module (all items), which takes longer than a single item.\n\nClick a lesson/quiz/video in the list first for faster single-item rework.\n\nContinue with module rework?`,
      );
      if (!ok) return;
    }

    setBusy(true);
    setError("");
    setNotice("");
    const isSingleItem = selectedItem !== null;
    setAiProgress(
      createAiProgress(
        isSingleItem ? "Reworking item" : "Reworking module",
        [
          { id: "prepare", label: "Prepare instructions and context" },
          {
            id: "ai",
            label: isSingleItem
              ? "AI revises item content"
              : "AI revises all items in module",
          },
          { id: "save", label: "Validate and save draft" },
        ],
        isSingleItem
          ? `Preparing rework for ${reworkTargetLabel ?? "selected item"}…`
          : `Preparing module rework for ${reworkTargetLabel ?? "selected module"}…`,
        isSingleItem ? "Usually 30 seconds to 2 minutes" : "Usually 2–5 minutes",
      ),
    );
    try {
      setAiProgress((prev) =>
        prev
          ? activateAiStep(prev, "ai", "Waiting for AI to apply your changes…")
          : prev,
      );
      const result = await reworkBlueprintSectionAction(
        sessionId,
        reworkInstruction,
        selectedModule,
        selectedItem ?? undefined,
      );
      if ("cancelled" in result && result.cancelled) {
        setNotice("Rework cancelled.");
        return;
      }
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      setAiProgress((prev) =>
        prev ? finishAiProgress(prev, "Rework complete") : prev,
      );
      if ("blueprint" in result && result.blueprint) setBlueprint(result.blueprint);
      if ("issues" in result && result.issues) setIssues(result.issues);
      setReworkInstruction("");
      setNotice(
        selectedItem !== null
          ? "Item rework complete."
          : "Module rework complete.",
      );
    } finally {
      setBusy(false);
      setAiProgress(null);
    }
  }

  const reworkTargetLabel =
    blueprint && selectedModule !== null
      ? selectedItem !== null
        ? (() => {
            const mod = blueprint.modules[selectedModule];
            const item = mod?.items[selectedItem];
            return item ? `${mod.title} → ${item.title}` : null;
          })()
        : blueprint.modules[selectedModule]?.title ?? null
      : null;

  const previewValidation = blueprint
    ? validateBlueprint(blueprint)
  : { ok: true, issues: [] as BlueprintIssue[] };

  const applyBlocked =
    !previewValidation.ok ||
    (blueprint?.generationSkippedItems?.length ?? 0) > 0;

  const contentGenerationCanResume =
    !!sessionId &&
    structureApproved &&
    !!blueprint &&
    contentItemCursor < flattenTotal(blueprint);

  const hasActiveDraft =
    !!sessionId && sessionStatus !== null && sessionStatus !== "applied";

  useEffect(() => {
    if (step === "preview" && blueprint) {
      setIssues(validateBlueprint(blueprint).issues);
      setGenerationWarnings(warningsFromBlueprint(blueprint));
    }
  }, [step, blueprint]);

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
    step === "processing" ||
    (busy && step !== "generating_content") ||
    !!retryingItem;

  const loadingMessage = getAiStudioLoadingMessage({
    step,
    contentProgress,
    activeWork: busy && step === "preview",
    reworkScope: busy && step === "preview" ? reworkTargetLabel : null,
  });

  const loadingView = aiProgress ? (
    <AiLoadingView progress={aiProgress} />
  ) : (
    <AiLoadingSpinner
      label={loadingMessage.label}
      timeEstimate={loadingMessage.timeEstimate}
    />
  );

  return (
    <div className="relative max-w-5xl space-y-6">
      {showSpinner && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 rounded-xl bg-white/80">
          {loadingView}
          {sessionId && (
            <button
              type="button"
              disabled={stopping}
              onClick={() => void handleStopGeneration()}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-red-200 bg-white px-4 text-sm font-medium text-red-800 hover:bg-red-50 disabled:opacity-50"
            >
              <Square className="h-4 w-4 fill-current" />
              {stopping ? "Stopping…" : "Stop"}
            </button>
          )}
        </div>
      )}

      <div className="rounded-xl border border-storm-light-blue/50 bg-white p-4 sm:p-6">
        <h2 className="font-title text-lg font-semibold text-storm-navy">AI Studio</h2>
        <p className="mt-1 text-sm text-storm-navy/70">
          Add sources with notes, generate the course outline first, then generate
          full content for each lesson, video, and quiz one at a time.
        </p>
        {hasActiveDraft && sessionStatus && (
          <div className="mt-4 flex flex-col gap-3 rounded-lg border border-storm-medium-blue/30 bg-storm-medium-blue/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-storm-navy">
              <span className="font-medium">Draft saved</span>
              <span className="text-storm-navy/70">
                {" "}
                — {sessionStatusLabel(sessionStatus)}. Your progress is stored automatically;
                you don&apos;t need to apply to the course until you&apos;re ready.
              </span>
            </p>
            <button
              type="button"
              onClick={saveDraftAndLeave}
              className="shrink-0 min-h-10 rounded-lg border border-storm-medium-blue/40 bg-white px-4 text-sm font-medium text-storm-medium-blue hover:bg-storm-medium-blue/5"
            >
              Save draft &amp; leave
            </button>
          </div>
        )}
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

      {generationWarnings.length > 0 &&
        (step === "generating_content" || step === "preview") && (
        <div
          className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          role="alert"
        >
          <p className="font-semibold">
            {generationWarnings.length} item
            {generationWarnings.length === 1 ? "" : "s"} need attention
          </p>
          <p className="mt-1 text-amber-900/90">
            AI could not finish these items. Each entry includes the reason. You can
            rework them below, use Try again on each item, or fix them in the course builder after apply.
          </p>
          <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto">
            {generationWarnings.map((w) => (
              <li
                key={w}
                className="rounded-lg border border-amber-200/80 bg-white/60 px-3 py-2 text-amber-950"
              >
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}

      {notice && (
        <div className="rounded-lg border border-storm-light-blue/60 bg-storm-light-blue/15 px-4 py-3 text-sm text-storm-navy">
          {notice}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {step === "intent" && (
        <div className="space-y-4 rounded-xl border bg-white p-4 sm:p-6">
          {hasActiveDraft && sessionStatus && (
            <div className="flex flex-col gap-3 rounded-lg border border-storm-medium-blue/30 bg-storm-medium-blue/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-storm-navy">
                You have a saved draft ({sessionStatusLabel(sessionStatus)}). Continue where
                you left off, or start a new session (this discards the draft).
              </p>
              <button
                type="button"
                onClick={() => {
                  const nextStep = wizardStepFromSessionStatus(sessionStatus, {
                    hasAssets: assets.length > 0,
                    hasBlueprint: !!blueprint,
                  });
                  setStep(nextStep);
                  setNotice(
                    `Continuing your draft (${sessionStatusLabel(sessionStatus)}).`,
                  );
                }}
                className="shrink-0 min-h-10 rounded-lg bg-storm-medium-blue px-4 text-sm font-semibold text-white"
              >
                Continue draft
              </button>
            </div>
          )}
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

          <ItemTypePicker
            value={allowedItemTypes}
            onChange={(types) => {
              setAllowedItemTypes(types);
              if (!types.includes("VIDEO")) {
                setDiscoverYoutubeVideos(false);
              }
              if (!types.includes("LESSON")) {
                setDiscoverImages(false);
              }
            }}
          />

          {allowedItemTypes.includes("LESSON") && (
            <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-storm-light-blue/50 bg-storm-light-grey/25 p-3 text-sm text-storm-navy">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 shrink-0"
                checked={discoverImages}
                onChange={(e) => setDiscoverImages(e.target.checked)}
              />
              <span>
                <span className="font-medium">Find related photos automatically</span>
                <span className="mt-1 block text-xs text-storm-navy/65">
                  AI builds a search query and picks the top Google image result for each
                  lesson. Requires <code className="text-[11px]">GOOGLE_CLOUD_API_KEY</code> and{" "}
                  <code className="text-[11px]">GOOGLE_CSE_ID</code>. You can replace photos
                  later in the course builder.
                </span>
              </span>
            </label>
          )}

          {allowedItemTypes.includes("VIDEO") && (
            <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-storm-light-blue/50 bg-storm-light-grey/25 p-3 text-sm text-storm-navy">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 shrink-0"
                checked={discoverYoutubeVideos}
                onChange={(e) => setDiscoverYoutubeVideos(e.target.checked)}
              />
              <span>
                <span className="font-medium">Find related YouTube videos automatically</span>
                <span className="mt-1 block text-xs text-storm-navy/65">
                  AI builds a search query and picks the top YouTube result for each video
                  lesson. Requires <code className="text-[11px]">GOOGLE_CLOUD_API_KEY</code>.
                  You can change the video link later in the course builder.
                </span>
              </span>
            </label>
          )}

          <label className="block text-sm">
            <span className="font-medium text-storm-navy">Instructions (optional)</span>
            <textarea
              className="mt-1 w-full rounded-lg border border-storm-light-blue/60 px-3 py-2"
              rows={4}
              value={userPrompt}
              onChange={(e) => setUserPrompt(e.target.value)}
              placeholder="Audience, topics to emphasize, module count… (AI defaults to lessons + quizzes, ending with an exam)"
            />
          </label>

          <button
            type="button"
            disabled={
              busy ||
              allowedItemTypes.length === 0 ||
              (mode !== "course" && !targetModuleId)
            }
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
            include its own note, or pick ready items from the{" "}
            <a href="/library" className="text-storm-medium-blue underline">
              Library
            </a>
            .
          </p>

          <section className="space-y-3 rounded-lg border border-storm-light-blue/40 p-4">
            <h3 className="text-sm font-medium text-storm-navy">From library</h3>
            <p className="text-xs text-storm-navy/60">
              Reuse PDFs, videos, and other materials you or your team uploaded with
              descriptions.
            </p>
            <LibraryPicker
              selectedIds={librarySelectedIds}
              selectedTagIds={librarySelectedTagIds}
              onChange={setLibrarySelectedIds}
              onTagSelectionChange={setLibrarySelectedTagIds}
              disabled={busy}
            />
            <button
              type="button"
              disabled={
                busy ||
                (librarySelectedIds.length === 0 && librarySelectedTagIds.length === 0)
              }
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  const result = await attachLibraryAssetsToSession(
                    sessionId,
                    librarySelectedIds,
                    librarySelectedTagIds,
                  );
                  if (result.error) {
                    setError(result.error);
                    return;
                  }
                  setLibrarySelectedIds([]);
                  setLibrarySelectedTagIds([]);
                  await pollSession(sessionId);
                } finally {
                  setBusy(false);
                }
              }}
              className="min-h-10 rounded-lg border px-4 text-sm font-medium"
            >
              Add from library
              {(librarySelectedIds.length > 0 || librarySelectedTagIds.length > 0) &&
                ` (${librarySelectedIds.length} item${librarySelectedIds.length === 1 ? "" : "s"}${librarySelectedTagIds.length > 0 ? `, ${librarySelectedTagIds.length} tag${librarySelectedTagIds.length === 1 ? "" : "s"}` : ""})`}
            </button>
          </section>

          <section className="space-y-3 rounded-lg border border-storm-light-blue/40 p-4">
            <h3 className="text-sm font-medium text-storm-navy">Files</h3>
            <p className="text-xs text-storm-navy/60">
              Select one or more files, add a note for each, then upload.
            </p>
            <FileInput
              multiple
              accept=".pdf,.pptx,.ppt,.mp3,.wav,.m4a,.mp4,.mov,.webm,.png,.jpg,.jpeg,.txt,.md"
              onChange={onFilesSelected}
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
                    {a.blobUrl && isYouTubeUrl(a.blobUrl) && (
                      <div className="mt-2 overflow-hidden rounded-lg bg-storm-navy">
                        <YouTubeIframe
                          urlOrId={a.blobUrl}
                          title={a.filename ?? "YouTube source"}
                        />
                      </div>
                    )}
                    {a.blobUrl && !isYouTubeUrl(a.blobUrl) && a.kind === "image" && (
                      <div className="mt-2 overflow-hidden rounded-lg border">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={a.blobUrl}
                          alt={a.filename ?? "Source image"}
                          className="max-h-48 w-full object-contain"
                        />
                      </div>
                    )}
                    {a.blobUrl &&
                      !isYouTubeUrl(a.blobUrl) &&
                      a.kind !== "image" && (
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
              onClick={skipProcessing}
              className="min-h-10 rounded-lg border px-4 text-sm text-storm-navy/70"
            >
              Skip processing
            </button>
          </div>
        </div>
      )}

      {step === "processing" && (
        <div className="space-y-4 rounded-xl border bg-white p-4">
          {loadingView}
          {sessionId && (
            <div className="flex justify-center">
              <button
                type="button"
                disabled={stopping}
                onClick={() => void handleStopGeneration()}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-red-200 px-4 text-sm font-medium text-red-800 hover:bg-red-50 disabled:opacity-50"
              >
                <Square className="h-4 w-4 fill-current" />
                {stopping ? "Stopping…" : "Stop"}
              </button>
            </div>
          )}
        </div>
      )}

      {step === "generate" && sessionId && (
        <div className="space-y-4 rounded-xl border bg-white p-4 sm:p-6">
          <p className="text-sm text-storm-navy/70">
            Step 1: AI creates modules and items with titles and outlines only — no
            full lesson or quiz content yet.
          </p>
          <ItemTypePicker value={allowedItemTypes} onChange={setAllowedItemTypes} />
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
            disabled={busy || allowedItemTypes.length === 0}
            onClick={runGenerateStructure}
            className="min-h-11 rounded-lg bg-storm-medium-blue px-6 text-sm font-medium text-white disabled:opacity-50"
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
        <div className="space-y-3 rounded-xl border bg-white p-4">
          {loadingView}
          {sessionId && (
            <div className="flex justify-center">
              <button
                type="button"
                disabled={stopping}
                onClick={() => void handleStopGeneration()}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-red-200 px-4 text-sm font-medium text-red-800 hover:bg-red-50 disabled:opacity-50"
              >
                <Square className="h-4 w-4 fill-current" />
                {stopping ? "Stopping…" : "Stop"}
              </button>
            </div>
          )}
          {generationWarnings.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              <p className="font-medium">
                {generationWarnings.length} item
                {generationWarnings.length === 1 ? "" : "s"} skipped so far — see
                alert above for details
              </p>
            </div>
          )}
        </div>
      )}

      {step === "preview" && blueprint && (
        <div className="space-y-4">
          <BlueprintPreview
            blueprint={blueprint}
            issues={previewValidation.issues}
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
            onRetryItem={(mi, ii) => void runRetryItem(mi, ii)}
            retryingItem={retryingItem}
            retryDisabled={busy || !!retryingItem}
          />

          <div className="rounded-xl border bg-white p-4">
            <label className="block text-sm font-medium">Rework selection</label>
            <p className="mt-1 text-xs text-storm-navy/65">
              Click a specific lesson, quiz, or video in the structure list above. Rework
              only changes that selection — not the whole course.
            </p>
            {reworkTargetLabel ? (
              <p className="mt-2 rounded-lg bg-storm-light-blue/15 px-3 py-2 text-xs text-storm-navy">
                <span className="font-medium">Target: </span>
                {reworkTargetLabel}
                {selectedItem === null && (
                  <span className="text-amber-800">
                    {" "}
                    (whole module — click an item for faster rework)
                  </span>
                )}
              </p>
            ) : (
              <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                Select an item in the structure list to enable rework.
              </p>
            )}
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
                disabled={
                  busy ||
                  !reworkInstruction.trim() ||
                  selectedModule === null ||
                  (selectedItem === null && !blueprint?.modules[selectedModule]?.items.length)
                }
                onClick={runRework}
                className="min-h-10 shrink-0 rounded-lg border px-4 text-sm font-medium disabled:opacity-50"
              >
                Rework
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {contentGenerationCanResume && (
              <button
                type="button"
                disabled={busy}
                onClick={runContinueContentGeneration}
                className="min-h-11 rounded-lg border border-storm-medium-blue/50 bg-storm-medium-blue/5 px-6 text-sm font-medium text-storm-medium-blue disabled:opacity-50"
              >
                Continue generation ({contentItemCursor} of {flattenTotal(blueprint)}{" "}
                done)
              </button>
            )}
            {applyBlocked && (
              <p className="w-full text-sm text-amber-900">
                {previewValidation.issues.some((i) => i.level === "error")
                  ? "Fix validation errors before applying to the course. Your draft is still saved — you can leave and return later."
                  : "Some items still need attention before applying. Your draft is saved — use Continue generation or rework, or come back later."}
              </p>
            )}
            {hasActiveDraft && (
              <button
                type="button"
                disabled={busy}
                onClick={saveDraftAndLeave}
                className="min-h-11 rounded-lg border border-storm-medium-blue/50 px-6 text-sm font-medium text-storm-medium-blue"
              >
                Save draft &amp; leave
              </button>
            )}
            <button
              type="button"
              disabled={busy || applyBlocked}
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
