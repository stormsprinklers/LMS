"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

type VideoProgressState = {
  watchedSeconds: number;
  durationSeconds: number;
  reportProgress: (watched: number, durationSeconds?: number) => void;
};

const VideoProgressContext = createContext<VideoProgressState | null>(null);

export function CourseItemVideoProgressProvider({
  initialWatchedSeconds,
  initialDurationSeconds,
  children,
}: {
  initialWatchedSeconds: number;
  initialDurationSeconds: number;
  children: ReactNode;
}) {
  const [watchedSeconds, setWatchedSeconds] = useState(initialWatchedSeconds);
  const [durationSeconds, setDurationSeconds] = useState(initialDurationSeconds);

  const reportProgress = useCallback((watched: number, duration?: number) => {
    setWatchedSeconds((prev) => Math.max(prev, watched));
    if (duration && duration > 0) {
      setDurationSeconds(duration);
    }
  }, []);

  return (
    <VideoProgressContext.Provider
      value={{ watchedSeconds, durationSeconds, reportProgress }}
    >
      {children}
    </VideoProgressContext.Provider>
  );
}

export function useCourseItemVideoProgress() {
  return useContext(VideoProgressContext);
}
