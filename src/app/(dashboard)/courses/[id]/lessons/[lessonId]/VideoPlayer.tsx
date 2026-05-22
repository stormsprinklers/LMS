"use client";

import MuxPlayer from "@mux/mux-player-react";
import { updateVideoProgress } from "@/lib/actions/progress";
import { useCallback, useRef } from "react";

export function VideoPlayer({
  lessonId,
  playbackId,
  initialSeconds,
}: {
  lessonId: string;
  playbackId: string;
  initialSeconds: number;
}) {
  const lastSaved = useRef(0);

  const onTimeUpdate = useCallback(
    (e: Event) => {
      const target = e.target as HTMLVideoElement;
      const current = Math.floor(target.currentTime);
      if (current - lastSaved.current >= 10) {
        lastSaved.current = current;
        void updateVideoProgress(lessonId, current);
      }
    },
    [lessonId],
  );

  return (
    <MuxPlayer
      playbackId={playbackId}
      startTime={initialSeconds}
      streamType="on-demand"
      onTimeUpdate={onTimeUpdate}
      onEnded={() => void updateVideoProgress(lessonId, 999999)}
      className="aspect-video w-full"
      accentColor="#4C9BC8"
    />
  );
}
