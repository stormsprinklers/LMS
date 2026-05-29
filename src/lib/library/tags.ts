import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export type LibraryTagListItem = {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  assetCount: number;
};

export function slugFromTagName(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return base || "tag";
}

function formatError(e: unknown): string {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2002") return "A tag with that name already exists.";
    if (e.code === "P2021") {
      return "Library tag tables are missing. Run npm run db:migrate:deploy.";
    }
  }
  return e instanceof Error ? e.message : "Something went wrong.";
}

export async function listLibraryTagsImpl(): Promise<{
  tags?: LibraryTagListItem[];
  error?: string;
}> {
  try {
    const rows = await prisma.libraryTag.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: { select: { assets: true } },
      },
    });
    return {
      tags: rows.map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        color: t.color,
        assetCount: t._count.assets,
      })),
    };
  } catch (e) {
    return { error: formatError(e) };
  }
}

export async function createLibraryTagImpl(
  name: string,
  color?: string | null,
): Promise<{ tag?: LibraryTagListItem; error?: string }> {
  try {
    const trimmed = name.trim();
    if (!trimmed) return { error: "Tag name is required." };

    let slug = slugFromTagName(trimmed);
    const existingSlug = await prisma.libraryTag.findUnique({ where: { slug } });
    if (existingSlug) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    const tag = await prisma.libraryTag.create({
      data: {
        name: trimmed,
        slug,
        color: color?.trim() || null,
      },
      include: { _count: { select: { assets: true } } },
    });

    return {
      tag: {
        id: tag.id,
        name: tag.name,
        slug: tag.slug,
        color: tag.color,
        assetCount: tag._count.assets,
      },
    };
  } catch (e) {
    return { error: formatError(e) };
  }
}

export async function updateLibraryTagImpl(
  tagId: string,
  data: { name?: string; color?: string | null },
): Promise<{ error?: string }> {
  try {
    const updates: { name?: string; slug?: string; color?: string | null } = {};
    if (data.name !== undefined) {
      const trimmed = data.name.trim();
      if (!trimmed) return { error: "Tag name is required." };
      updates.name = trimmed;
      updates.slug = slugFromTagName(trimmed);
    }
    if (data.color !== undefined) {
      updates.color = data.color?.trim() || null;
    }

    await prisma.libraryTag.update({
      where: { id: tagId },
      data: updates,
    });
    return {};
  } catch (e) {
    return { error: formatError(e) };
  }
}

export async function deleteLibraryTagImpl(tagId: string): Promise<{ error?: string }> {
  try {
    await prisma.libraryTag.delete({ where: { id: tagId } });
    return {};
  } catch (e) {
    return { error: formatError(e) };
  }
}

export async function validateTagIds(tagIds: string[]): Promise<string[]> {
  if (!tagIds.length) return [];
  const unique = [...new Set(tagIds)];
  const found = await prisma.libraryTag.findMany({
    where: { id: { in: unique } },
    select: { id: true },
  });
  if (found.length !== unique.length) {
    throw new Error("One or more tags were not found.");
  }
  return unique;
}

export async function setLibraryAssetTagsImpl(
  assetId: string,
  tagIds: string[],
): Promise<{ error?: string }> {
  try {
    const validIds = await validateTagIds(tagIds);
    await prisma.$transaction([
      prisma.libraryAssetTag.deleteMany({ where: { assetId } }),
      ...(validIds.length
        ? [
            prisma.libraryAssetTag.createMany({
              data: validIds.map((tagId) => ({ assetId, tagId })),
              skipDuplicates: true,
            }),
          ]
        : []),
    ]);
    return {};
  } catch (e) {
    return { error: formatError(e) };
  }
}

export async function getReadyLibraryAssetIdsByTagIds(
  userId: string,
  tagIds: string[],
): Promise<string[]> {
  if (!tagIds.length) return [];
  const uniqueTagIds = [...new Set(tagIds)];

  const assets = await prisma.libraryAsset.findMany({
    where: {
      archived: false,
      processingStatus: "ready",
      OR: [{ scope: "shared" }, { createdById: userId }],
      tags: { some: { tagId: { in: uniqueTagIds } } },
    },
    select: { id: true },
  });

  return assets.map((a) => a.id);
}
