"use client";

import { useCallback, useEffect, useRef } from "react";
import { useCourseBuilderUnsaved } from "./CourseBuilderUnsavedContext";

export function useBuilderFormDirty(
  id: string,
  formRef: React.RefObject<HTMLFormElement | null>,
) {
  const { setDirty, registerSave, unregister } = useCourseBuilderUnsaved();
  const pendingSaveRef = useRef<((ok: boolean) => void) | null>(null);

  const markDirty = useCallback(() => setDirty(id, true), [id, setDirty]);
  const markClean = useCallback(() => setDirty(id, false), [id, setDirty]);

  const save = useCallback(async (): Promise<boolean> => {
    const form = formRef.current;
    if (!form) return false;
    return new Promise<boolean>((resolve) => {
      pendingSaveRef.current = resolve;
      form.requestSubmit();
    });
  }, [formRef]);

  const resolveSave = useCallback(
    (ok: boolean) => {
      pendingSaveRef.current?.(ok);
      pendingSaveRef.current = null;
      if (ok) markClean();
    },
    [markClean],
  );

  useEffect(() => {
    registerSave(id, save);
    return () => unregister(id);
  }, [id, save, registerSave, unregister]);

  const formDirtyProps = {
    onInput: markDirty,
    onChange: markDirty,
  };

  return { markDirty, markClean, resolveSave, formDirtyProps };
}
