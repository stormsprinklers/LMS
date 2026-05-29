import type { LibraryAssetScope } from "@prisma/client";
import type { LibraryTagListItem } from "@/lib/library/tags";

export type { LibraryTagListItem };

export type LibraryAssetListItem = {
  id: string;
  title: string;
  description: string;
  scope: LibraryAssetScope;
  kind: string;
  filename: string | null;
  mimeType: string | null;
  fileSizeBytes: number | null;
  blobUrl: string | null;
  muxPlaybackId: string | null;
  processingStatus: string;
  processingError: string | null;
  createdAt: string;
  createdBy: { id: string; name: string | null; email: string };
  isOwner: boolean;
  tags: Pick<LibraryTagListItem, "id" | "name" | "slug" | "color">[];
};
