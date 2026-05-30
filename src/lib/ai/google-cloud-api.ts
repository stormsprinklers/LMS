/** Google Cloud API key — used for YouTube Data API and Custom Search API. */
export function getGoogleCloudApiKey(): string | null {
  const key =
    process.env.GOOGLE_CLOUD_API_KEY?.trim() ||
    process.env.YOUTUBE_API_KEY?.trim();
  return key || null;
}

/** Programmable Search Engine ID (cx) for image search. */
export function getGoogleCseId(): string | null {
  const id = process.env.GOOGLE_CSE_ID?.trim();
  return id || null;
}
