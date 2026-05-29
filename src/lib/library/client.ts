import type { LibraryAssetListItem } from "@/lib/library/types";
import type { LibraryCreateInput } from "@/lib/library/create-assets";
import type { LibraryAssetScope } from "@prisma/client";
import type { LibraryTagListItem } from "@/lib/library/tags";

export async function fetchLibraryTags(): Promise<{
  tags?: LibraryTagListItem[];
  error?: string;
}> {
  const res = await fetch("/api/library/tags", { cache: "no-store" });
  const data = (await res.json()) as { tags?: LibraryTagListItem[]; error?: string };
  if (!res.ok) return { error: data.error ?? "Could not load tags." };
  return data;
}

export async function saveLibraryAssetTags(
  assetId: string,
  tagIds: string[],
): Promise<{ error?: string }> {
  const res = await fetch(`/api/library/assets/${assetId}/tags`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tagIds }),
  });
  const data = (await res.json()) as { error?: string };
  if (!res.ok) return { error: data.error ?? "Could not save tags." };
  return {};
}

export async function createLibraryTag(name: string, color?: string | null) {
  const res = await fetch("/api/library/tags", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, color }),
  });
  const data = (await res.json()) as { tag?: LibraryTagListItem; error?: string };
  if (!res.ok) return { error: data.error ?? "Could not create tag." };
  return data;
}

export async function deleteLibraryTag(id: string) {
  const res = await fetch(`/api/library/tags?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  const data = (await res.json()) as { error?: string };
  if (!res.ok) return { error: data.error ?? "Could not delete tag." };
  return {};
}

export async function fetchLibraryAssets(): Promise<{
  assets?: LibraryAssetListItem[];
  error?: string;
}> {
  const res = await fetch("/api/library/assets", { cache: "no-store" });
  const data = (await res.json()) as {
    assets?: LibraryAssetListItem[];
    error?: string;
  };
  if (!res.ok) {
    return { error: data.error ?? "Could not load library." };
  }
  return data;
}

export async function saveLibraryAssetsBatch(
  items: LibraryCreateInput[],
  scope: LibraryAssetScope,
  tagIds: string[] = [],
): Promise<{ created?: number; error?: string; errors?: string[] }> {
  const res = await fetch("/api/library/assets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items, scope, tagIds }),
  });
  const data = (await res.json()) as {
    created?: number;
    error?: string;
    errors?: string[];
  };
  if (!res.ok && !data.created) {
    return { error: data.error ?? "Upload failed." };
  }
  return data;
}
