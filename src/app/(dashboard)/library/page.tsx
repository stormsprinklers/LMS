import { PageHeader } from "@/components/ui/PageHeader";
import { LibraryExplorer } from "@/components/library/LibraryExplorer";
import { requireUser } from "@/lib/auth-utils";
import { isStaff } from "@/lib/auth/permissions";
import { listLibraryAssets } from "@/lib/actions/library";

export const metadata = { title: "Library" };

export default async function LibraryPage() {
  const session = await requireUser();
  const role = (session.user as { role?: string }).role;
  const result = await listLibraryAssets();

  return (
    <>
      <PageHeader
        title="Library"
        description="Browse materials by type. Upload PDFs, photos, videos, and links for yourself, your team, or AI Studio."
      />
      <LibraryExplorer
        canPublishShared={isStaff(role)}
        initialAssets={result.assets ?? []}
      />
    </>
  );
}
