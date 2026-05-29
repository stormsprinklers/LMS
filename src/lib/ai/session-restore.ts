import type { AiSessionStatus } from "@prisma/client";

export type AiStudioWizardStep =
  | "intent"
  | "sources"
  | "processing"
  | "generate"
  | "structure_preview"
  | "generating_content"
  | "preview";

export function wizardStepFromSessionStatus(
  status: AiSessionStatus,
  options?: { hasAssets?: boolean; hasBlueprint?: boolean },
): AiStudioWizardStep {
  const hasAssets = options?.hasAssets ?? false;
  const hasBlueprint = options?.hasBlueprint ?? false;

  switch (status) {
    case "collecting":
      return hasAssets ? "sources" : "sources";
    case "processing":
      return "processing";
    case "generating":
      return "generate";
    case "structure_ready":
      return "structure_preview";
    case "generating_content":
      return "generating_content";
    case "ready":
      return "preview";
    case "failed":
      return hasBlueprint ? "preview" : "generate";
    case "applied":
      return "intent";
    default:
      return "intent";
  }
}

export function sessionStatusLabel(status: AiSessionStatus): string {
  switch (status) {
    case "collecting":
      return "Adding sources";
    case "processing":
      return "Processing sources";
    case "generating":
      return "Generating structure";
    case "structure_ready":
      return "Structure ready for review";
    case "generating_content":
      return "Writing content";
    case "ready":
      return "Draft ready";
    case "failed":
      return "Generation failed";
    case "applied":
      return "Applied";
    default:
      return status;
  }
}
