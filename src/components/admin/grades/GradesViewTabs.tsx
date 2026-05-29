"use client";

import Link from "next/link";

export type GradesView = "pending" | "published";

export function GradesViewTabs({
  active,
  showPublished,
}: {
  active: GradesView;
  showPublished: boolean;
}) {
  const tabClass = (view: GradesView) =>
    `rounded-full px-4 py-2 text-sm font-medium no-underline ${
      active === view
        ? "bg-storm-medium-blue text-white"
        : "bg-storm-light-grey/60 text-storm-navy/70 hover:bg-storm-light-blue/30"
    }`;

  return (
    <div className="flex flex-wrap gap-2">
      <Link href="/admin/grades?view=pending" className={tabClass("pending")}>
        Pending review
      </Link>
      {showPublished && (
        <Link href="/admin/grades?view=published" className={tabClass("published")}>
          Published grades
        </Link>
      )}
    </div>
  );
}
