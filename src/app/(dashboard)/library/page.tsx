import { PageHeader } from "@/components/ui/PageHeader";
import { LibraryExplorer } from "@/components/library/LibraryExplorer";
import { LibraryTagAdminPanel } from "@/components/library/LibraryTagAdminPanel";
import { requireUser } from "@/lib/auth-utils";
import { isAdmin, isStaff } from "@/lib/auth/permissions";
import { listLibraryAssets } from "@/lib/actions/library";
import { listLibraryTagsImpl } from "@/lib/library/tags";

export const metadata = { title: "Library" };

export default async function LibraryPage() {
  const session = await requireUser();
  const role = (session.user as { role?: string }).role;
  const result = await listLibraryAssets();
  const tagsResult = await listLibraryTagsImpl();

  return (
    <>
      <PageHeader
        title="Library"
        description="Browse materials by tag. Upload PDFs, photos, videos, and links for yourself, your team, or AI Studio."
      />
      {isAdmin(role) && (
        <div className="mb-6">
          <LibraryTagAdminPanel />
        </div>
      )}
      <LibraryExplorer
        canPublishShared={isStaff(role)}
        initialAssets={result.assets ?? []}
        initialTags={tagsResult.tags ?? []}
      />
    </>
  );
}
