"use client";

import { prepareLessonHtmlForDisplay, type LessonMediaAsset } from "@/lib/ai/lesson-html";

export function LessonHtmlContent({
  html,
  assets = [],
  className = "",
}: {
  html: string;
  assets?: LessonMediaAsset[];
  className?: string;
}) {
  const prepared = prepareLessonHtmlForDisplay(html, assets);

  return (
    <div
      className={`lesson-content ${className}`.trim()}
      dangerouslySetInnerHTML={{ __html: prepared }}
    />
  );
}
