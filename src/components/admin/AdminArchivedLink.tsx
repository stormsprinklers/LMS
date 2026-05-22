import Link from "next/link";
import { Archive } from "lucide-react";

export function AdminArchivedLink() {
  return (
    <Link
      href="/admin/archived"
      className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-storm-light-blue/60 bg-white px-4 py-2 text-sm font-medium text-storm-navy no-underline hover:bg-storm-light-grey/50"
    >
      <Archive className="h-4 w-4" aria-hidden />
      View archived
    </Link>
  );
}
