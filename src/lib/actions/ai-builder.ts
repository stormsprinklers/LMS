"use server";

import { put } from "@vercel/blob";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireManageCourse } from "@/lib/auth-utils";
import type { AiGenerationMode } from "@prisma/client";
import {
  courseBlueprintSchema,
  parseStructureFromLlm,
  courseStructureJsonSchema,
  structureToBlueprint,
  type CourseBlueprint,
} from "@/lib/ai/blueprint-schema";
import { validateBlueprint, validateStructureBlueprint } from "@/lib/ai/validate-blueprint";
import { buildStructureGenerationMessages, assetsToBlueprintRefs } from "@/lib/ai/build-prompt";
import { processAllSessionAssets } from "@/lib/ai/process-sources";
import { reworkBlueprintSection } from "@/lib/ai/rework";
import { importCourseBlueprint } from "@/lib/ai/import-blueprint";
import { requireOpenAI, AI_GENERATION_MODEL } from "@/lib/ai/openai-client";
import { isYouTubeUrl } from "@/lib/video/youtube";
import { flattenBlueprintItems } from "@/lib/ai/blueprint-items";
import { generateItemContent } from "@/lib/ai/generate-item-content";
import { parseGenerationMessages } from "@/lib/ai/generation-thread";
import {
  parseAllowedItemTypes,
  filterStructureByAllowedTypes,
  filterBlueprintByAllowedTypes,
  type BlueprintItemType,
} from "@/lib/ai/allowed-item-types";
import {
  kindFromMime,
  isHttpUrl,
  MAX_MEDIA_FILE_BYTES,
} from "@/lib/media/asset-utils";
import { getReadyLibraryAssetIdsByTagIds } from "@/lib/library/tags";

const MAX_FILE_BYTES = MAX_MEDIA_FILE_BYTES;
const MAX_ASSETS_PER_SESSION = 20;

function formatPrismaActionError(e: unknown): string {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2021") {
    return "AI Studio database tables are missing. Run npm run db:migrate:deploy with your production DATABASE_URL (see scripts/apply-ai-studio-schema.sql).";
  }
  return e instanceof Error ? e.message : "Something went wrong.";
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

function sessionAllowedTypes(raw: unknown): BlueprintItemType[] {
  return parseAllowedItemTypes(raw);
}

export async function createAiSession(
  courseId: string,
  mode: AiGenerationMode,
  options?: {
    targetModuleId?: string;
    userPrompt?: string;
    allowedItemTypes?: BlueprintItemType[];
  },
) {
  try {
    const session = await requireManageCourse(courseId);
    const allowed = options?.allowedItemTypes?.length
      ? options.allowedItemTypes
      : parseAllowedItemTypes(null);

    const aiSession = await prisma.aiGenerationSession.create({
      data: {
        courseId,
        createdById: session.user.id,
        mode,
        targetModuleId: options?.targetModuleId ?? null,
        userPrompt: options?.userPrompt?.trim() || null,
        allowedItemTypes: allowed,
        status: "collecting",
      },
      include: { assets: { orderBy: { sortOrder: "asc" } } },
    });
    revalidatePath(`/admin/courses/${courseId}/builder`);
    return { session: aiSession };
  } catch (e) {
    return { error: formatPrismaActionError(e) };
  }
}

export async function updateAiSessionAllowedItemTypes(
  sessionId: string,
  allowedItemTypes: BlueprintItemType[],
) {
  if (allowedItemTypes.length === 0) {
    return { error: "Select at least one item type." };
  }
  const row = await prisma.aiGenerationSession.findUnique({
    where: { id: sessionId },
    select: { courseId: true },
  });
  if (!row) return { error: "Session not found." };
  await requireManageCourse(row.courseId);
  await prisma.aiGenerationSession.update({
    where: { id: sessionId },
    data: { allowedItemTypes },
  });
  return { success: true as const };
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

export async function attachLibraryAssetsToSession(
  sessionId: string,
  libraryAssetIds: string[],
  tagIds: string[] = [],
): Promise<{ attached?: number; error?: string }> {
  try {
    const session = await requireUserForAiSession(sessionId);
    const userId = session.userId;

    const fromTags =
      tagIds.length > 0
        ? await getReadyLibraryAssetIdsByTagIds(userId, tagIds)
        : [];

    const uniqueIds = [...new Set([...libraryAssetIds, ...fromTags])];
    if (!uniqueIds.length) {
      return { error: "Select library items or tags with ready materials." };
    }
    const currentCount = await prisma.aiSourceAsset.count({ where: { sessionId } });
    if (currentCount + uniqueIds.length > MAX_ASSETS_PER_SESSION) {
      return {
        error: `Maximum ${MAX_ASSETS_PER_SESSION} sources per session (including library items).`,
      };
    }

    const libraryRows = await prisma.libraryAsset.findMany({
      where: { id: { in: uniqueIds }, archived: false },
    });
    if (libraryRows.length !== uniqueIds.length) {
      return { error: "One or more library items were not found." };
    }

    for (const lib of libraryRows) {
      if (lib.scope !== "shared" && lib.createdById !== userId) {
        return { error: "You cannot use a private library item owned by someone else." };
      }
    }

    let sortOrder = currentCount;
    for (const lib of libraryRows) {
      await prisma.aiSourceAsset.create({
        data: {
          sessionId,
          libraryAssetId: lib.id,
          kind: lib.kind,
          filename: lib.filename ?? lib.title,
          mimeType: lib.mimeType,
          blobUrl: lib.blobUrl,
          placementHint: lib.description,
          includeRecording: lib.includeRecording,
          extractedText: lib.extractedText,
          transcript: lib.transcript,
          summary: lib.summary,
          durationSeconds: lib.durationSeconds,
          muxAssetId: lib.muxAssetId,
          muxPlaybackId: lib.muxPlaybackId,
          processingStatus: lib.processingStatus,
          processingError: lib.processingError,
          sortOrder: sortOrder++,
        },
      });
    }

    return { attached: libraryRows.length };
  } catch (e) {
    return { error: formatPrismaActionError(e) };
  }
}

async function requireUserForAiSession(sessionId: string) {
  const aiSession = await prisma.aiGenerationSession.findUnique({
    where: { id: sessionId },
    select: { courseId: true },
  });
  if (!aiSession) throw new Error("Session not found.");
  const authSession = await requireManageCourse(aiSession.courseId);
  return { userId: authSession.user.id };
}

export async function uploadAiSource(
  sessionId: string,
  formData: FormData,
): Promise<{ asset?: { id: string }; error?: string }> {
  try {
    return await uploadAiSourceInner(sessionId, formData);
  } catch (e) {
    return { error: formatPrismaActionError(e) };
  }
}

async function uploadAiSourceInner(
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

async function loadSessionForGeneration(sessionId: string) {
  const aiSession = await prisma.aiGenerationSession.findUnique({
    where: { id: sessionId },
    include: {
      course: true,
      assets: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!aiSession) return null;
  await requireManageCourse(aiSession.courseId);
  return aiSession;
}

export async function generateCourseStructure(sessionId: string) {
  const aiSession = await loadSessionForGeneration(sessionId);
  if (!aiSession) return { error: "Session not found." };

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
    data: {
      status: "generating",
      error: null,
      contentItemCursor: 0,
      structureApproved: false,
      generationMessages: [],
    },
  });

  const allowed = sessionAllowedTypes(aiSession.allowedItemTypes);

  try {
    const { system, user } = buildStructureGenerationMessages({
      mode: aiSession.mode,
      userPrompt: aiSession.userPrompt ?? "",
      courseTitle: aiSession.course.title,
      courseDescription: aiSession.course.description,
      targetModuleTitle,
      assets: aiSession.assets,
      allowedItemTypes: allowed,
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
          name: "course_structure",
          strict: false,
          schema: courseStructureJsonSchema as Record<string, unknown>,
        },
      },
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) throw new Error("No response from AI.");

    let structure = parseStructureFromLlm(JSON.parse(raw));
    structure = filterStructureByAllowedTypes(structure, allowed);
    if (structure.modules.every((m) => m.items.length === 0)) {
      throw new Error(
        "Structure has no items for your selected types. Adjust item types or instructions and try again.",
      );
    }
    const skeleton = structureToBlueprint(structure);
    const enriched = enrichBlueprintWithAssets(
      filterBlueprintByAllowedTypes(skeleton, allowed),
      aiSession.assets,
    );
    const validation = validateStructureBlueprint(structure, allowed);

    await prisma.aiGenerationSession.update({
      where: { id: sessionId },
      data: {
        status: "structure_ready",
        blueprintJson: enriched as object,
        error: null,
      },
    });

    revalidatePath(`/admin/courses/${aiSession.courseId}/builder`);
    return { blueprint: enriched, issues: validation.issues, phase: "structure" as const };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Structure generation failed.";
    await prisma.aiGenerationSession.update({
      where: { id: sessionId },
      data: { status: "failed", error: message },
    });
    return { error: message };
  }
}

export async function approveStructureAndGenerateContent(sessionId: string) {
  const aiSession = await loadSessionForGeneration(sessionId);
  if (!aiSession?.blueprintJson) return { error: "Generate a structure first." };

  await prisma.aiGenerationSession.update({
    where: { id: sessionId },
    data: {
      structureApproved: true,
      contentItemCursor: 0,
      generationMessages: [],
      status: "generating_content",
      error: null,
    },
  });

  return { success: true as const };
}

export async function generateNextBlueprintItem(sessionId: string) {
  const aiSession = await loadSessionForGeneration(sessionId);
  if (!aiSession?.blueprintJson) return { error: "No blueprint found." };
  if (!aiSession.structureApproved) {
    return { error: "Approve the structure before generating content." };
  }

  const allowed = sessionAllowedTypes(aiSession.allowedItemTypes);
  const blueprint = filterBlueprintByAllowedTypes(
    enrichBlueprintWithAssets(
      courseBlueprintSchema.parse(aiSession.blueprintJson),
      aiSession.assets,
    ),
    allowed,
  );
  const flat = flattenBlueprintItems(blueprint);
  const cursor = aiSession.contentItemCursor;

  if (cursor >= flat.length) {
    await prisma.aiGenerationSession.update({
      where: { id: sessionId },
      data: { status: "ready" },
    });
    return {
      done: true as const,
      blueprint,
      progress: { current: flat.length, total: flat.length },
    };
  }

  const { moduleIndex, itemIndex, item, moduleTitle } = flat[cursor];

  try {
    const thread = parseGenerationMessages(aiSession.generationMessages);
    const generation = await generateItemContent({
      blueprint,
      moduleIndex,
      itemIndex,
      assets: aiSession.assets,
      thread,
      userPrompt: aiSession.userPrompt ?? "",
      allowedItemTypes: allowed,
    });

    const existingSkipped = blueprint.generationSkippedItems ?? [];
    let nextBlueprint: CourseBlueprint = blueprint;
    let skippedThisItem:
      | {
          moduleIndex: number;
          itemIndex: number;
          title: string;
          moduleTitle: string;
          reason: string;
        }
      | undefined;

    if (generation.ok) {
      nextBlueprint = {
        ...blueprint,
        modules: blueprint.modules.map((mod, mi) =>
          mi !== moduleIndex
            ? mod
            : {
                ...mod,
                items: mod.items.map((it, ii) =>
                  ii !== itemIndex ? it : generation.item,
                ),
              },
        ),
      };
    } else {
      skippedThisItem = {
        moduleIndex,
        itemIndex,
        title: item.title,
        moduleTitle,
        reason: generation.reason,
      };
      nextBlueprint = {
        ...blueprint,
        generationSkippedItems: [
          ...existingSkipped.filter(
            (s) =>
              !(
                s.moduleIndex === moduleIndex && s.itemIndex === itemIndex
              ),
          ),
          skippedThisItem,
        ],
      };
    }

    const enriched = enrichBlueprintWithAssets(nextBlueprint, aiSession.assets);
    const nextCursor = cursor + 1;
    const done = nextCursor >= flat.length;

    await prisma.aiGenerationSession.update({
      where: { id: sessionId },
      data: {
        blueprintJson: enriched as object,
        generationMessages: generation.thread as object[],
        contentItemCursor: nextCursor,
        status: done ? "ready" : "generating_content",
        error: null,
      },
    });

    revalidatePath(`/admin/courses/${aiSession.courseId}/builder`);

    return {
      done,
      blueprint: enriched,
      progress: {
        current: nextCursor,
        total: flat.length,
        label: `${moduleTitle} → ${item.title}`,
      },
      skippedItem: skippedThisItem,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Content generation failed.";
    await prisma.aiGenerationSession.update({
      where: { id: sessionId },
      data: { status: "failed", error: message },
    });
    return { error: message };
  }
}

/** @deprecated Use generateCourseStructure + generateNextBlueprintItem */
export async function generateCourseBlueprint(sessionId: string) {
  return generateCourseStructure(sessionId);
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
