import type { LibraryAssetListItem } from "@/lib/library/types";
import type { LibraryCreateInput } from "@/lib/library/create-assets";
import type { LibraryAssetScope } from "@prisma/client";

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
): Promise<{ created?: number; error?: string; errors?: string[] }> {
  const res = await fetch("/api/library/assets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items, scope }),
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
