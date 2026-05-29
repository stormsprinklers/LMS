/** Default % of video duration required before marking complete / advancing. */
export const DEFAULT_REQUIRED_WATCH_PERCENT = 75;

export function watchThresholdSeconds(
  durationSeconds: number,
  requiredPercent: number = DEFAULT_REQUIRED_WATCH_PERCENT,
): number {
  if (durationSeconds <= 0) return 0;
  return (durationSeconds * requiredPercent) / 100;
}

export function hasMetWatchRequirement(
  watchedSeconds: number,
  durationSeconds: number,
  requiredPercent: number = DEFAULT_REQUIRED_WATCH_PERCENT,
): boolean {
  const threshold = watchThresholdSeconds(durationSeconds, requiredPercent);
  if (threshold <= 0) {
    return watchedSeconds > 0;
  }
  return watchedSeconds >= threshold;
}

export function watchPercent(
  watchedSeconds: number,
  durationSeconds: number,
): number {
  if (durationSeconds <= 0) return 0;
  return Math.min(100, Math.round((watchedSeconds / durationSeconds) * 100));
}
