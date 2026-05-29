"use client";

import { parseYouTubeVideoId } from "@/lib/video/youtube";
import { useEffect, useId, useRef } from "react";

type YTPlayer = {
  destroy: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
};

type YTNamespace = {
  Player: new (
    elementId: string,
    options: {
      videoId: string;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: (event: { target: YTPlayer }) => void;
        onStateChange?: (event: { data: number }) => void;
      };
    },
  ) => YTPlayer;
  PlayerState: { PLAYING: number; ENDED: number; PAUSED: number };
};

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let ytApiPromise: Promise<void> | null = null;

function loadYouTubeIframeApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();
  if (ytApiPromise) return ytApiPromise;

  ytApiPromise = new Promise((resolve) => {
    if (window.YT?.Player) {
      resolve();
      return;
    }

    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };

    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
    }
  });

  return ytApiPromise;
}

export function YouTubePlayer({
  urlOrId,
  startSeconds = 0,
  onTimeUpdate,
  onEnded,
  title = "Training video",
}: {
  urlOrId: string;
  startSeconds?: number;
  onTimeUpdate?: (seconds: number, durationSeconds?: number) => void;
  onEnded?: () => void;
  title?: string;
}) {
  const videoId = parseYouTubeVideoId(urlOrId);
  const containerId = useId().replace(/:/g, "");
  const playerRef = useRef<YTPlayer | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onTimeUpdateRef = useRef(onTimeUpdate);
  const onEndedRef = useRef(onEnded);

  onTimeUpdateRef.current = onTimeUpdate;
  onEndedRef.current = onEnded;

  useEffect(() => {
    if (!videoId) return;

    let cancelled = false;

    void loadYouTubeIframeApi().then(() => {
      if (cancelled || !window.YT) return;

      playerRef.current = new window.YT.Player(containerId, {
        videoId,
        playerVars: {
          start: startSeconds,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
        },
        events: {
          onReady: (event) => {
            if (startSeconds > 0) {
              event.target.seekTo(startSeconds, true);
            }
            const duration = Math.floor(event.target.getDuration?.() ?? 0);
            if (duration > 0) {
              onTimeUpdateRef.current?.(startSeconds, duration);
            }
          },
          onStateChange: (event) => {
            const YT = window.YT;
            if (!YT) return;

            const tick = () => {
              const current = Math.floor(playerRef.current?.getCurrentTime() ?? 0);
              const duration = Math.floor(playerRef.current?.getDuration?.() ?? 0);
              onTimeUpdateRef.current?.(current, duration > 0 ? duration : undefined);
            };

            if (event.data === YT.PlayerState.PLAYING && onTimeUpdateRef.current) {
              if (intervalRef.current) clearInterval(intervalRef.current);
              tick();
              intervalRef.current = setInterval(tick, 10_000);
            }

            if (event.data === YT.PlayerState.ENDED) {
              if (intervalRef.current) clearInterval(intervalRef.current);
              tick();
              onEndedRef.current?.();
            }

            if (event.data === YT.PlayerState.PAUSED) {
              tick();
              if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
              }
            }
          },
        },
      });
    });

    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [videoId, containerId, startSeconds]);

  if (!videoId) return null;

  return (
    <div
      className="aspect-video w-full overflow-hidden rounded-xl bg-black"
      aria-label={title}
    >
      <div id={containerId} className="h-full w-full" />
    </div>
  );
}
