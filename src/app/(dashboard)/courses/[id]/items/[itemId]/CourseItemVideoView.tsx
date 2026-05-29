"use client";

import { updateCourseItemVideoProgress } from "@/lib/actions/course-progress";
import { YouTubePlayer } from "@/components/video/YouTubePlayer";
import { isYouTubeUrl } from "@/lib/video/youtube";
import MuxPlayer from "@mux/mux-player-react";
import { useCallback, useRef, type SyntheticEvent } from "react";
import { useCourseItemVideoProgress } from "./CourseItemVideoProgressContext";

export function CourseItemVideoView({
  courseItemId,
  playbackId,
  videoUrl,
  initialSeconds,
  estimatedMinutes,
  durationSeconds: storedDurationSeconds,
  preview = false,
}: {
  courseItemId: string;
  playbackId: string | null;
  videoUrl: string | null;
  initialSeconds: number;
  estimatedMinutes: number | null;
  durationSeconds: number | null;
  preview?: boolean;
}) {
  const videoProgress = useCourseItemVideoProgress();
  const maxWatched = useRef(initialSeconds);
  const lastSaved = useRef(0);
  const durationRef = useRef(
    storedDurationSeconds ??
      (estimatedMinutes ? estimatedMinutes * 60 : 0),
  );

  const report = useCallback(
    (watched: number, duration?: number) => {
      maxWatched.current = Math.max(maxWatched.current, watched);
      if (duration && duration > 0) {
        durationRef.current = duration;
      }
      videoProgress?.reportProgress(maxWatched.current, durationRef.current);
    },
    [videoProgress],
  );

  const saveProgress = useCallback(
    (current: number, duration?: number) => {
      if (preview) return;
      report(current, duration);
      if (current - lastSaved.current >= 10) {
        lastSaved.current = current;
        void updateCourseItemVideoProgress(
          courseItemId,
          maxWatched.current,
          durationRef.current > 0 ?
            Math.ceil(durationRef.current / 60)
          : (estimatedMinutes ?? undefined),
        );
      }
    },
    [courseItemId, estimatedMinutes, preview, report],
  );

  const flushProgress = useCallback(() => {
    if (preview) return;
    void updateCourseItemVideoProgress(
      courseItemId,
      maxWatched.current,
      durationRef.current > 0 ?
        Math.ceil(durationRef.current / 60)
      : (estimatedMinutes ?? undefined),
    );
  }, [courseItemId, estimatedMinutes, preview]);

  const onMuxTimeUpdate = useCallback(
    (e: Event) => {
      const target = e.target as HTMLVideoElement;
      const duration = Math.floor(target.duration || 0);
      saveProgress(Math.floor(target.currentTime), duration || undefined);
    },
    [saveProgress],
  );

  const onMuxLoadedMetadata = useCallback(
    (e: Event) => {
      const target = e.target as HTMLVideoElement;
      const duration = Math.floor(target.duration || 0);
      if (duration > 0) {
        durationRef.current = duration;
        report(maxWatched.current, duration);
      }
    },
    [report],
  );

  const onVideoTimeUpdate = useCallback(
    (e: SyntheticEvent<HTMLVideoElement>) => {
      const el = e.currentTarget;
      const duration = Math.floor(el.duration || 0);
      saveProgress(Math.floor(el.currentTime), duration || undefined);
    },
    [saveProgress],
  );

  const onVideoLoadedMetadata = useCallback(
    (e: SyntheticEvent<HTMLVideoElement>) => {
      const duration = Math.floor(e.currentTarget.duration || 0);
      if (duration > 0) {
        durationRef.current = duration;
        report(maxWatched.current, duration);
      }
    },
    [report],
  );

  const onEnded = useCallback(() => {
    if (durationRef.current > 0) {
      maxWatched.current = Math.max(maxWatched.current, durationRef.current);
    }
    report(maxWatched.current, durationRef.current);
    flushProgress();
  }, [flushProgress, report]);

  if (playbackId) {
    return (
      <div className="mt-6 overflow-hidden rounded-xl bg-storm-navy">
        <MuxPlayer
          playbackId={playbackId}
          startTime={initialSeconds}
          streamType="on-demand"
          onTimeUpdate={onMuxTimeUpdate}
          onLoadedMetadata={onMuxLoadedMetadata}
          onEnded={onEnded}
          className="aspect-video w-full"
          accentColor="#4C9BC8"
        />
      </div>
    );
  }

  if (videoUrl && isYouTubeUrl(videoUrl)) {
    return (
      <div className="mt-6">
        <YouTubePlayer
          urlOrId={videoUrl}
          startSeconds={initialSeconds}
          onTimeUpdate={(sec, duration) => saveProgress(sec, duration)}
          onEnded={onEnded}
        />
      </div>
    );
  }

  if (videoUrl) {
    return (
      <div className="mt-6 overflow-hidden rounded-xl bg-storm-navy">
        <video
          src={videoUrl}
          controls
          className="aspect-video w-full"
          onTimeUpdate={onVideoTimeUpdate}
          onLoadedMetadata={onVideoLoadedMetadata}
          onEnded={onEnded}
        />
      </div>
    );
  }

  return (
    <div className="mt-6 flex aspect-video flex-col items-center justify-center gap-2 rounded-xl bg-storm-light-grey px-4 text-center text-sm text-storm-navy/60">
      <p>No video attached yet.</p>
      {preview && (
        <p className="text-xs text-storm-navy/50">
          In the course builder, upload a file or add a YouTube link, then save video settings.
          Set status to Published when ready for trainees.
        </p>
      )}
    </div>
  );
}
