"use server";

import { put } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireManageCourse } from "@/lib/auth-utils";
import type { AiGenerationMode, AiSourceAssetKind } from "@prisma/client";
import {
  courseBlueprintSchema,
  parseCourseBlueprintFromLlm,
  courseBlueprintJsonSchema,
  type CourseBlueprint,
} from "@/lib/ai/blueprint-schema";
import { validateBlueprint } from "@/lib/ai/validate-blueprint";
import { buildGenerationMessages, assetsToBlueprintRefs } from "@/lib/ai/build-prompt";
import { processAllSessionAssets } from "@/lib/ai/process-sources";
import { reworkBlueprintSection } from "@/lib/ai/rework";
import { importCourseBlueprint } from "@/lib/ai/import-blueprint";
import { AI_GENERATION_MODEL, requireOpenAI } from "@/lib/ai/openai-client";
import { isYouTubeUrl } from "@/lib/video/youtube";

const MAX_FILE_BYTES = 80 * 1024 * 1024;
const MAX_ASSETS_PER_SESSION = 20;

function kindFromMime(mime: string, filename: string): AiSourceAssetKind {
  const lower = filename.toLowerCase();
  if (mime.includes("pdf") || lower.endsWith(".pdf")) return "pdf";
  if (
    mime.includes("presentation") ||
    lower.endsWith(".pptx") ||
    lower.endsWith(".ppt")
  ) {
    return "pptx";
  }
  if (mime.startsWith("audio/") || /\.(mp3|wav|m4a|ogg)$/i.test(lower)) return "audio";
  if (mime.startsWith("video/") || /\.(mp4|mov|webm)$/i.test(lower)) return "video";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("text/") || lower.endsWith(".txt") || lower.endsWith(".md")) {
    return "text";
  }
  return "text";
}

function enrichBlueprintWithAssets(
  blueprint: CourseBlueprint,
  assets: Awaited<ReturnType<typeof loadSessionAssets>>,
): CourseBlueprint {
  const refs = assetsToBlueprintRefs(assets) ?? [];
  const merged = [...(blueprint.sourceAssets ?? [])];
  for (const ref of refs) {
    const idx = merged.findIndex((a) => a.id === ref.id);
    if (idx >= 0) merged[idx] = { ...merged[idx], ...ref };
    else merged.push(ref);
  }
  return { ...blueprint, sourceAssets: merged };
}

async function loadSessionAssets(sessionId: string) {
  return prisma.aiSourceAsset.findMany({
    where: { sessionId },
    orderBy: { sortOrder: "asc" },
  });
}

export async function createAiSession(
  courseId: string,
  mode: AiGenerationMode,
  options?: { targetModuleId?: string; userPrompt?: string },
) {
  const session = await requireManageCourse(courseId);
  const aiSession = await prisma.aiGenerationSession.create({
    data: {
      courseId,
      createdById: session.user.id,
      mode,
      targetModuleId: options?.targetModuleId ?? null,
      userPrompt: options?.userPrompt?.trim() || null,
      status: "collecting",
    },
    include: { assets: { orderBy: { sortOrder: "asc" } } },
  });
  revalidatePath(`/admin/courses/${courseId}/builder`);
  return { session: aiSession };
}

export async function getAiSession(sessionId: string) {
  const row = await prisma.aiGenerationSession.findUnique({
    where: { id: sessionId },
    include: {
      assets: { orderBy: { sortOrder: "asc" } },
      course: { select: { id: true, title: true, description: true } },
    },
  });
  if (!row) return { error: "Session not found." };
  await requireManageCourse(row.courseId);
  return { session: row };
}

export async function updateAiSessionPrompt(sessionId: string, userPrompt: string) {
  const row = await prisma.aiGenerationSession.findUnique({
    where: { id: sessionId },
    select: { courseId: true },
  });
  if (!row) return { error: "Session not found." };
  await requireManageCourse(row.courseId);
  await prisma.aiGenerationSession.update({
    where: { id: sessionId },
    data: { userPrompt: userPrompt.trim() || null },
  });
  return { success: true as const };
}

function readSourceNote(formData: FormData): string | null {
  const note = String(
    formData.get("sourceNote") ?? formData.get("placementHint") ?? "",
  ).trim();
  return note || null;
}

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export async function uploadAiSource(
  sessionId: string,
  formData: FormData,
): Promise<{ asset?: { id: string }; error?: string }> {
  const aiSession = await prisma.aiGenerationSession.findUnique({
    where: { id: sessionId },
    include: { _count: { select: { assets: true } } },
  });
  if (!aiSession) return { error: "Session not found." };
  await requireManageCourse(aiSession.courseId);

  if (aiSession._count.assets >= MAX_ASSETS_PER_SESSION) {
    return { error: `Maximum ${MAX_ASSETS_PER_SESSION} files per session.` };
  }

  const sourceNote = readSourceNote(formData);
  if (!sourceNote) {
    return {
      error: "Add a note describing this source (what it is and how to use it).",
    };
  }

  const includeRecording = formData.get("includeRecording") !== "false";
  const sortOrder = aiSession._count.assets;

  const pastedText = String(formData.get("pastedText") ?? "").trim();
  if (pastedText) {
    const title =
      String(formData.get("pastedTitle") ?? "").trim() || "Pasted text";
    const asset = await prisma.aiSourceAsset.create({
      data: {
        sessionId,
        kind: "text",
        filename: title.slice(0, 120),
        placementHint: sourceNote,
        extractedText: pastedText,
        includeRecording: false,
        processingStatus: "ready",
        sortOrder,
      },
    });
    return { asset: { id: asset.id } };
  }

  const sourceUrl = String(
    formData.get("sourceUrl") ?? formData.get("embedUrl") ?? "",
  ).trim();
  const urlKind = String(formData.get("urlKind") ?? "webpage");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    if (!sourceUrl) {
      return { error: "Choose a file, paste text, or enter a URL." };
    }
    if (!isHttpUrl(sourceUrl)) {
      return { error: "Enter a valid http(s) URL." };
    }

    const asVideo = urlKind === "video" || isYouTubeUrl(sourceUrl);
    const asset = await prisma.aiSourceAsset.create({
      data: {
        sessionId,
        kind: asVideo ? "video" : "webpage",
        filename: asVideo ? "Video link" : "Web page",
        blobUrl: sourceUrl,
        placementHint: sourceNote,
        includeRecording: asVideo ? includeRecording : false,
        extractedText: asVideo && isYouTubeUrl(sourceUrl) ? sourceUrl : null,
        processingStatus: "pending",
        sortOrder,
      },
    });
    return { asset: { id: asset.id } };
  }

  if (file.size > MAX_FILE_BYTES) {
    return { error: "File exceeds 80MB limit." };
  }

  const kind = kindFromMime(file.type, file.name);
  const textContent =
    kind === "text" ? await file.text().catch(() => null) : null;

  const blob = await put(`ai-sources/${sessionId}/${Date.now()}-${file.name}`, file, {
    access: "public",
  });

  const asset = await prisma.aiSourceAsset.create({
    data: {
      sessionId,
      kind,
      filename: file.name,
      mimeType: file.type || null,
      blobUrl: blob.url,
      placementHint: sourceNote,
      includeRecording: kind === "video" ? includeRecording : false,
      sortOrder,
      processingStatus:
        kind === "image" || (kind === "text" && textContent) ? "ready" : "pending",
      ...(textContent ? { extractedText: textContent } : {}),
    },
  });

  return { asset: { id: asset.id } };
}

export async function updateAiSourceMeta(
  assetId: string,
  data: { placementHint?: string; includeRecording?: boolean },
) {
  const asset = await prisma.aiSourceAsset.findUnique({
    where: { id: assetId },
    include: { session: { select: { courseId: true } } },
  });
  if (!asset) return { error: "Asset not found." };
  await requireManageCourse(asset.session.courseId);
  await prisma.aiSourceAsset.update({
    where: { id: assetId },
    data: {
      placementHint: data.placementHint?.trim() || asset.placementHint,
      includeRecording: data.includeRecording ?? asset.includeRecording,
    },
  });
  return { success: true as const };
}

export async function processAiSession(sessionId: string) {
  const aiSession = await prisma.aiGenerationSession.findUnique({
    where: { id: sessionId },
    select: { courseId: true },
  });
  if (!aiSession) return { error: "Session not found." };
  await requireManageCourse(aiSession.courseId);

  await prisma.aiGenerationSession.update({
    where: { id: sessionId },
    data: { status: "processing", error: null },
  });

  try {
    await processAllSessionAssets(sessionId);
    await prisma.aiGenerationSession.update({
      where: { id: sessionId },
      data: { status: "collecting" },
    });
    return { success: true as const };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Processing failed.";
    await prisma.aiGenerationSession.update({
      where: { id: sessionId },
      data: { status: "failed", error: message },
    });
    return { error: message };
  }
}

export async function generateCourseBlueprint(sessionId: string) {
  const aiSession = await prisma.aiGenerationSession.findUnique({
    where: { id: sessionId },
    include: {
      course: true,
      assets: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!aiSession) return { error: "Session not found." };
  await requireManageCourse(aiSession.courseId);

  const openai = requireOpenAI();

  let targetModuleTitle: string | undefined;
  if (aiSession.targetModuleId) {
    const mod = await prisma.module.findUnique({
      where: { id: aiSession.targetModuleId },
      select: { title: true },
    });
    targetModuleTitle = mod?.title;
  }

  await prisma.aiGenerationSession.update({
    where: { id: sessionId },
    data: { status: "generating", error: null },
  });

  try {
    const { system, user } = buildGenerationMessages({
      mode: aiSession.mode,
      userPrompt: aiSession.userPrompt ?? "",
      courseTitle: aiSession.course.title,
      courseDescription: aiSession.course.description,
      targetModuleTitle,
      assets: aiSession.assets,
    });

    const completion = await openai.chat.completions.create({
      model: AI_GENERATION_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "course_blueprint",
          strict: false,
          schema: courseBlueprintJsonSchema as Record<string, unknown>,
        },
      },
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      throw new Error("No response from AI.");
    }

    const parsed = parseCourseBlueprintFromLlm(JSON.parse(raw));
    const enriched = enrichBlueprintWithAssets(parsed, aiSession.assets);
    const validation = validateBlueprint(enriched);

    await prisma.aiGenerationSession.update({
      where: { id: sessionId },
      data: {
        status: "ready",
        blueprintJson: enriched as object,
        error: null,
      },
    });

    revalidatePath(`/admin/courses/${aiSession.courseId}/builder`);
    return { blueprint: enriched, issues: validation.issues };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Generation failed.";
    await prisma.aiGenerationSession.update({
      where: { id: sessionId },
      data: { status: "failed", error: message },
    });
    return { error: message };
  }
}

export async function reworkBlueprintSectionAction(
  sessionId: string,
  instruction: string,
  moduleIndex?: number,
  itemIndex?: number,
) {
  const aiSession = await prisma.aiGenerationSession.findUnique({
    where: { id: sessionId },
    select: { courseId: true, blueprintJson: true },
  });
  if (!aiSession?.blueprintJson) return { error: "No blueprint to rework." };
  await requireManageCourse(aiSession.courseId);

  const current = courseBlueprintSchema.parse(aiSession.blueprintJson);
  const result = await reworkBlueprintSection(
    current,
    instruction,
    moduleIndex,
    itemIndex,
  );
  if (result.error || !result.blueprint) return { error: result.error ?? "Rework failed." };

  const assets = await loadSessionAssets(sessionId);
  const enriched = enrichBlueprintWithAssets(result.blueprint, assets);

  await prisma.aiGenerationSession.update({
    where: { id: sessionId },
    data: { blueprintJson: enriched as object, status: "ready" },
  });

  return { blueprint: enriched, issues: result.issues };
}

export async function applyCourseBlueprint(sessionId: string) {
  const aiSession = await prisma.aiGenerationSession.findUnique({
    where: { id: sessionId },
    include: { assets: true },
  });
  if (!aiSession?.blueprintJson) return { error: "No blueprint to apply." };
  await requireManageCourse(aiSession.courseId);

  const blueprint = enrichBlueprintWithAssets(
    courseBlueprintSchema.parse(aiSession.blueprintJson),
    aiSession.assets,
  );

  const result = await importCourseBlueprint(aiSession.courseId, blueprint, {
    targetModuleId: aiSession.targetModuleId ?? undefined,
    replaceCourseMeta: aiSession.mode === "course",
  });

  if (result.error) return result;

  await prisma.aiGenerationSession.update({
    where: { id: sessionId },
    data: { status: "applied" },
  });

  revalidatePath(`/admin/courses/${aiSession.courseId}/builder`);
  return { success: true as const };
}

export async function deleteAiSourceAsset(assetId: string) {
  const asset = await prisma.aiSourceAsset.findUnique({
    where: { id: assetId },
    include: { session: { select: { courseId: true } } },
  });
  if (!asset) return { error: "Not found." };
  await requireManageCourse(asset.session.courseId);
  await prisma.aiSourceAsset.delete({ where: { id: assetId } });
  return { success: true as const };
}
