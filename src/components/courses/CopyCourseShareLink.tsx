"use client";

import { useState } from "react";

export function CopyCourseShareLink({
  slug,
  published,
  compact = false,
}: {
  slug: string;
  published: boolean;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const path = `/courses/${slug}`;

  async function copy() {
    const url = `${window.location.origin}${path}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={() => void copy()}
        className="inline-flex min-h-10 items-center rounded-lg border border-storm-light-blue/60 px-4 py-2 text-sm font-medium text-storm-navy"
        title={published ? "Copy learner link" : "Copy link (works after publish)"}
      >
        {copied ? "Copied" : "Copy link"}
      </button>
    );
  }

  return (
    <div className="rounded-xl border bg-white p-4 sm:p-6">
      <h2 className="font-medium text-storm-navy">Share course</h2>
      <p className="mt-1 text-sm text-storm-navy/60">
        {published
          ? "Anyone already signed into the LMS can open this link to view the course."
          : "This link will work for signed-in org members after the course is published."}
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <p className="min-w-0 flex-1 break-all rounded-lg border border-storm-light-blue/60 bg-storm-light-grey/40 px-3 py-2.5 text-sm text-storm-medium-blue">
          {path}
        </p>
        <button
          type="button"
          onClick={() => void copy()}
          className="shrink-0 min-h-11 rounded-lg bg-storm-medium-blue px-4 text-sm font-semibold text-white"
        >
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>
    </div>
  );
}
