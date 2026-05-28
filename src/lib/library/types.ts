import type { LibraryAssetScope } from "@prisma/client";

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
};
