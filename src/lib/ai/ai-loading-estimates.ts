/** Rough per-item content generation time for remaining-time math. */
const SECONDS_PER_CONTENT_ITEM = 45;

export function formatContentGenerationEstimate(
  current: number,
  total: number,
): string {
  const remaining = Math.max(0, total - current);
  if (remaining === 0) {
    return "Finishing up — usually under a minute";
  }
  const seconds = remaining * SECONDS_PER_CONTENT_ITEM;
  if (seconds < 90) {
    return `About ${Math.max(30, Math.round(seconds / 10) * 10)} seconds remaining`;
  }
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return `About ${minutes} min remaining (${remaining} item${remaining === 1 ? "" : "s"} left, ~${SECONDS_PER_CONTENT_ITEM}s each)`;
}

export type AiLoadingMessage = {
  label: string;
  timeEstimate: string;
};

export function getAiStudioLoadingMessage(options: {
  step:
    | "intent"
    | "sources"
    | "processing"
    | "generate"
    | "structure_preview"
    | "generating_content"
    | "preview";
  contentProgress?: { current: number; total: number; label?: string } | null;
  activeWork?: boolean;
}): AiLoadingMessage {
  const { step, contentProgress, activeWork } = options;

  if (step === "preview" && activeWork) {
    return {
      label: "Revising course content…",
      timeEstimate: "Usually about 30 seconds to 2 minutes",
    };
  }

  if (step === "processing") {
    return {
      label: "Extracting text and transcribing media…",
      timeEstimate: "Usually 1–5 minutes depending on file size and count",
    };
  }

  if (step === "generating_content") {
    if (contentProgress && contentProgress.total > 0) {
      return {
        label: `Writing item ${contentProgress.current + 1} of ${contentProgress.total}${contentProgress.label ? ` — ${contentProgress.label}` : ""}`,
        timeEstimate: formatContentGenerationEstimate(
          contentProgress.current,
          contentProgress.total,
        ),
      };
    }
    return {
      label: "Generating content…",
      timeEstimate: "About 30–90 seconds per item",
    };
  }

  if (step === "generate") {
    return {
      label: "Generating course structure…",
      timeEstimate: "Usually about 1–2 minutes",
    };
  }

  if (step === "preview" || step === "structure_preview") {
    return {
      label: "AI is working…",
      timeEstimate: "Usually about 30 seconds to 2 minutes",
    };
  }

  return {
    label: "AI is working…",
    timeEstimate: "Usually under 2 minutes",
  };
}
