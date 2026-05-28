import { upload } from "@vercel/blob/client";
import { MAX_MEDIA_FILE_BYTES } from "@/lib/media/asset-utils";
import { formatBlobUploadError } from "@/lib/media/blob-config";

export type UploadedLibraryFile = {
  blobUrl: string;
  filename: string;
  mimeType: string;
  fileSizeBytes: number;
};

export async function uploadLibraryFileToBlob(
  file: File,
): Promise<UploadedLibraryFile> {
  if (file.size > MAX_MEDIA_FILE_BYTES) {
    throw new Error("File exceeds 80MB limit.");
  }

  try {
    const blob = await upload(`library/${file.name}`, file, {
      access: "public",
      handleUploadUrl: "/api/library/upload",
    });
    return {
      blobUrl: blob.url,
      filename: file.name,
      mimeType: file.type || "",
      fileSizeBytes: file.size,
    };
  } catch (clientErr) {
    if (file.size > 4 * 1024 * 1024) {
      throw new Error(formatBlobUploadError(clientErr));
    }
    throw clientErr;
  }
}
