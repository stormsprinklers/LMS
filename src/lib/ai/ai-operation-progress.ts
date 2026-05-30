export type AiProgressStepStatus = "pending" | "active" | "done" | "error";

export type AiProgressStep = {
  id: string;
  label: string;
  status: AiProgressStepStatus;
};

export type AiOperationProgress = {
  title: string;
  detail: string;
  timeEstimate?: string;
  steps: AiProgressStep[];
  startedAt: number;
};

export function createAiProgress(
  title: string,
  stepLabels: { id: string; label: string }[],
  detail: string,
  timeEstimate?: string,
): AiOperationProgress {
  return {
    title,
    detail,
    timeEstimate,
    startedAt: Date.now(),
    steps: stepLabels.map((s, i) => ({
      id: s.id,
      label: s.label,
      status: i === 0 ? "active" : "pending",
    })),
  };
}

export function patchAiProgress(
  prev: AiOperationProgress,
  patch: Partial<Pick<AiOperationProgress, "title" | "detail" | "timeEstimate" | "steps">>,
): AiOperationProgress {
  return { ...prev, ...patch };
}

export function activateAiStep(
  prev: AiOperationProgress,
  stepId: string,
  detail: string,
): AiOperationProgress {
  return {
    ...prev,
    detail,
    steps: prev.steps.map((s) => {
      if (s.id === stepId) return { ...s, status: "active" };
      if (s.status === "active") return { ...s, status: "done" };
      return s;
    }),
  };
}

export function completeAiStep(
  prev: AiOperationProgress,
  stepId: string,
  detail: string,
): AiOperationProgress {
  return {
    ...prev,
    detail,
    steps: prev.steps.map((s) =>
      s.id === stepId ? { ...s, status: "done" } : s,
    ),
  };
}

export function finishAiProgress(
  prev: AiOperationProgress,
  detail: string,
): AiOperationProgress {
  return {
    ...prev,
    detail,
    steps: prev.steps.map((s) =>
      s.status === "active" || s.status === "pending"
        ? { ...s, status: "done" }
        : s,
    ),
  };
}

/** Derive processing phase text from source asset statuses. */
export function progressDetailForProcessingAssets(
  assets: { kind: string; processingStatus: string; filename: string | null }[],
): { detail: string; activeStepId: string } {
  const inFlight = assets.filter(
    (a) =>
      a.processingStatus === "pending" || a.processingStatus === "processing",
  );

  if (inFlight.length === 0) {
    return { detail: "Wrapping up source processing…", activeStepId: "finish" };
  }

  const kind = inFlight[0]?.kind;
  const name = inFlight[0]?.filename?.trim();

  if (kind === "pdf" || kind === "pptx" || kind === "text") {
    return {
      detail: name
        ? `Extracting text from ${name}…`
        : "Extracting text from documents…",
      activeStepId: "extract",
    };
  }

  if (kind === "video" || kind === "audio") {
    return {
      detail: name ? `Transcribing ${name}…` : "Transcribing audio or video…",
      activeStepId: "transcribe",
    };
  }

  if (kind === "webpage") {
    return {
      detail: name ? `Fetching ${name}…` : "Fetching web page content…",
      activeStepId: "extract",
    };
  }

  return {
    detail: `Processing ${inFlight.length} source file${inFlight.length === 1 ? "" : "s"}…`,
    activeStepId: "extract",
  };
}
