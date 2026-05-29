"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type SaveHandler = () => Promise<boolean>;

type PendingNavigation = {
  onProceed: () => void;
};

type CourseBuilderUnsavedContextValue = {
  hasUnsavedChanges: boolean;
  setDirty: (id: string, dirty: boolean) => void;
  registerSave: (id: string, handler: SaveHandler) => void;
  unregister: (id: string) => void;
  confirmNavigation: (onProceed: () => void) => void;
};

const CourseBuilderUnsavedContext =
  createContext<CourseBuilderUnsavedContextValue | null>(null);

const AI_DRAFT_DIRTY_ID = "ai-studio";

export function CourseBuilderUnsavedProvider({ children }: { children: ReactNode }) {
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(() => new Set());
  const saveHandlers = useRef<Map<string, SaveHandler>>(new Map());
  const [pending, setPending] = useState<PendingNavigation | null>(null);
  const [saving, setSaving] = useState(false);

  const hasUnsavedChanges = dirtyIds.size > 0;
  const hasAiDraftOnly =
    dirtyIds.size === 1 && dirtyIds.has(AI_DRAFT_DIRTY_ID);
  const hasFormDirty = [...dirtyIds].some((id) => id !== AI_DRAFT_DIRTY_ID);

  const setDirty = useCallback((id: string, dirty: boolean) => {
    setDirtyIds((prev) => {
      const has = prev.has(id);
      if (dirty && has) return prev;
      if (!dirty && !has) return prev;
      const next = new Set(prev);
      if (dirty) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const registerSave = useCallback((id: string, handler: SaveHandler) => {
    saveHandlers.current.set(id, handler);
  }, []);

  const unregister = useCallback((id: string) => {
    saveHandlers.current.delete(id);
    setDirtyIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const confirmNavigation = useCallback(
    (onProceed: () => void) => {
      if (!hasUnsavedChanges) {
        onProceed();
        return;
      }
      setPending({ onProceed });
    },
    [hasUnsavedChanges],
  );

  const closeDialog = useCallback(() => {
    setPending(null);
    setSaving(false);
  }, []);

  const proceed = useCallback(() => {
    const action = pending?.onProceed;
    closeDialog();
    action?.();
  }, [closeDialog, pending]);

  const discardAndProceed = useCallback(() => {
    setDirtyIds(new Set());
    proceed();
  }, [proceed]);

  const saveAllAndProceed = useCallback(async () => {
    setSaving(true);
    const ids = [...dirtyIds];
    let allOk = true;
    for (const id of ids) {
      const handler = saveHandlers.current.get(id);
      if (!handler) continue;
      const ok = await handler();
      if (!ok) {
        allOk = false;
        break;
      }
    }
    setSaving(false);
    if (allOk) proceed();
  }, [dirtyIds, proceed]);

  useEffect(() => {
    if (!hasUnsavedChanges || hasAiDraftOnly) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasUnsavedChanges, hasAiDraftOnly]);

  const value = useMemo(
    () => ({
      hasUnsavedChanges,
      setDirty,
      registerSave,
      unregister,
      confirmNavigation,
    }),
    [hasUnsavedChanges, setDirty, registerSave, unregister, confirmNavigation],
  );

  return (
    <CourseBuilderUnsavedContext.Provider value={value}>
      {children}
      {pending && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="unsaved-changes-title"
        >
          <div className="w-full max-w-md rounded-xl border border-storm-light-blue/60 bg-white p-5 shadow-xl">
            <h2 id="unsaved-changes-title" className="font-title text-lg font-bold text-storm-navy">
              {hasAiDraftOnly ? "Leave AI Studio?" : "Save changes?"}
            </h2>
            <p className="mt-2 text-sm text-storm-navy/70">
              {hasAiDraftOnly ? (
                <>
                  Your AI generation draft is saved automatically. You can return to AI Studio
                  anytime to continue, rework, or apply it to the course.
                </>
              ) : hasFormDirty && dirtyIds.has(AI_DRAFT_DIRTY_ID) ? (
                <>
                  You have unsaved form edits and an AI draft in progress. Save form changes
                  before leaving, or discard them. Your AI draft stays saved in AI Studio.
                </>
              ) : (
                <>
                  You have unsaved changes in the course builder. Save them before leaving, or
                  discard your edits.
                </>
              )}
            </p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeDialog}
                disabled={saving}
                className="min-h-10 rounded-lg border border-storm-light-blue/60 px-4 py-2 text-sm font-medium text-storm-navy disabled:opacity-50"
              >
                {hasAiDraftOnly ? "Stay" : "Cancel"}
              </button>
              {!hasAiDraftOnly && (
                <button
                  type="button"
                  onClick={discardAndProceed}
                  disabled={saving}
                  className="min-h-10 rounded-lg border border-storm-medium-blue/50 px-4 py-2 text-sm font-medium text-storm-medium-blue disabled:opacity-50"
                >
                  Don&apos;t save
                </button>
              )}
              <button
                type="button"
                onClick={() => (hasAiDraftOnly ? proceed() : void saveAllAndProceed())}
                disabled={saving}
                className="min-h-10 rounded-lg bg-storm-medium-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? "Saving…" : hasAiDraftOnly ? "Leave" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </CourseBuilderUnsavedContext.Provider>
  );
}

export function useCourseBuilderUnsaved() {
  const ctx = useContext(CourseBuilderUnsavedContext);
  if (!ctx) {
    throw new Error("useCourseBuilderUnsaved must be used within CourseBuilderUnsavedProvider");
  }
  return ctx;
}
