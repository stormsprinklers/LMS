"use client";

import Link from "next/link";
import { AdminEntityActions, type AdminEntityType } from "./AdminEntityActions";

export function AdminListCard({
  href,
  title,
  subtitle,
  type,
  id,
  archived = false,
  as: Tag = "li",
}: {
  href?: string;
  title: string;
  subtitle?: string;
  type: AdminEntityType;
  id: string;
  archived?: boolean;
  as?: "li" | "div";
}) {
  return (
    <Tag className="rounded-xl border border-storm-light-blue/60 bg-white p-4 block">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          {href ? (
            <Link
              href={href}
              className="font-title font-bold text-storm-navy no-underline hover:underline"
            >
              {title}
            </Link>
          ) : (
            <p className="font-title font-bold text-storm-navy">{title}</p>
          )}
          {subtitle && <p className="mt-1 text-sm text-storm-navy/60">{subtitle}</p>}
          {archived && (
            <span className="mt-2 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
              Archived
            </span>
          )}
        </div>
        <AdminEntityActions type={type} id={id} name={title} archived={archived} compact />
      </div>
    </Tag>
  );
}
