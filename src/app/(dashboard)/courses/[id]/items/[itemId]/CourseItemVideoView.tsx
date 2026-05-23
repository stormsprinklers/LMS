"use client";

import { updateCourseItemVideoProgress } from "@/lib/actions/course-progress";
import MuxPlayer from "@mux/mux-player-react";
import { useCallback, useRef, type SyntheticEvent } from "react";

export function CourseItemVideoView({
  courseItemId,
  playbackId,
  videoUrl,
  initialSeconds,
  estimatedMinutes,
}: {
  courseItemId: string;
  playbackId: string | null;
  videoUrl: string | null;
  initialSeconds: number;
  estimatedMinutes: number | null;
}) {
  const lastSaved = useRef(0);

  const saveProgress = useCallback(
    (current: number) => {
      if (current - lastSaved.current >= 10) {
        lastSaved.current = current;
        void updateCourseItemVideoProgress(
          courseItemId,
          current,
          estimatedMinutes ?? undefined,
        );
      }
    },
    [courseItemId, estimatedMinutes],
  );

  const onMuxTimeUpdate = useCallback(
    (e: Event) => {
      const target = e.target as HTMLVideoElement;
      saveProgress(Math.floor(target.currentTime));
    },
    [saveProgress],
  );

  const onVideoTimeUpdate = useCallback(
    (e: SyntheticEvent<HTMLVideoElement>) => {
      saveProgress(Math.floor(e.currentTarget.currentTime));
    },
    [saveProgress],
  );

  if (playbackId) {
    return (
      <div className="mt-6 overflow-hidden rounded-xl bg-storm-navy">
        <MuxPlayer
          playbackId={playbackId}
          startTime={initialSeconds}
          streamType="on-demand"
          onTimeUpdate={onMuxTimeUpdate}
          onEnded={() =>
            void updateCourseItemVideoProgress(
              courseItemId,
              999999,
              estimatedMinutes ?? undefined,
            )
          }
          className="aspect-video w-full"
          accentColor="#4C9BC8"
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
          onEnded={() =>
            void updateCourseItemVideoProgress(
              courseItemId,
              999999,
              estimatedMinutes ?? undefined,
            )
          }
        />
      </div>
    );
  }

  return (
    <div className="mt-6 flex aspect-video items-center justify-center rounded-xl bg-storm-light-grey text-sm text-storm-navy/60">
      Video not uploaded yet.
    </div>
  );
}
