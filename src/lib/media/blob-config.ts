export const BLOB_SETUP_MESSAGE =
  "File storage is not configured. In the Vercel dashboard, open your LMS project → Storage → Create Blob Store → connect it to this project. That adds BLOB_READ_WRITE_TOKEN automatically. For local dev, copy the token into .env.local and restart the dev server. See DEPLOYMENT.md for details.";

export function blobStorageError(): string | null {
  if (!process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    return BLOB_SETUP_MESSAGE;
  }
  return null;
}

export function formatBlobUploadError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (
    message.includes("client token") ||
    message.includes("BLOB_READ_WRITE_TOKEN") ||
    message.includes("No token found")
  ) {
    return BLOB_SETUP_MESSAGE;
  }
  return message || "Upload failed.";
}
