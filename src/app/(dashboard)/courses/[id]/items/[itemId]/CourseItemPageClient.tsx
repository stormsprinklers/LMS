"use client";

import { CourseItemNav } from "@/components/courses/CourseItemNav";
import type { CourseItemNavigation } from "@/lib/courses/item-navigation";
import { DEFAULT_REQUIRED_WATCH_PERCENT } from "@/lib/courses/video-watch";
import {
  CourseItemVideoProgressProvider,
  useCourseItemVideoProgress,
} from "./CourseItemVideoProgressContext";
import type { ReactNode } from "react";

function CourseItemNavWithVideo({
  navigation,
  preview,
  itemType,
  requiredWatchPercent,
  children,
}: {
  navigation: CourseItemNavigation;
  preview: boolean;
  itemType: string;
  requiredWatchPercent: number;
  children: ReactNode;
}) {
  const video = useCourseItemVideoProgress();

  const videoRequirement =
    itemType === "VIDEO" && !preview && video ?
      {
        watchedSeconds: video.watchedSeconds,
        durationSeconds: video.durationSeconds,
        requiredPercent: requiredWatchPercent,
      }
    : undefined;

  return (
    <>
      {children}
      <CourseItemNav
        previous={navigation.previous}
        next={navigation.next}
        position={navigation.position}
        total={navigation.total}
        preview={preview}
        videoRequirement={videoRequirement}
      />
    </>
  );
}

export function CourseItemPageClient({
  navigation,
  preview,
  itemType,
  requiredWatchPercent = DEFAULT_REQUIRED_WATCH_PERCENT,
  initialWatchedSeconds = 0,
  initialDurationSeconds = 0,
  children,
}: {
  navigation: CourseItemNavigation;
  preview: boolean;
  itemType: string;
  requiredWatchPercent?: number;
  initialWatchedSeconds?: number;
  initialDurationSeconds?: number;
  children: ReactNode;
}) {
  const needsVideoProgress = itemType === "VIDEO" && !preview;

  if (needsVideoProgress) {
    return (
      <CourseItemVideoProgressProvider
        initialWatchedSeconds={initialWatchedSeconds}
        initialDurationSeconds={initialDurationSeconds}
      >
        <CourseItemNavWithVideo
          navigation={navigation}
          preview={preview}
          itemType={itemType}
          requiredWatchPercent={requiredWatchPercent}
        >
          {children}
        </CourseItemNavWithVideo>
      </CourseItemVideoProgressProvider>
    );
  }

  return (
    <>
      {children}
      <CourseItemNav
        previous={navigation.previous}
        next={navigation.next}
        position={navigation.position}
        total={navigation.total}
        preview={preview}
      />
    </>
  );
}
