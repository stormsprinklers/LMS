import { PageHeader } from "@/components/ui/PageHeader";
import { LibraryBrowser } from "@/components/library/LibraryBrowser";
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
        description="Upload PDFs, photos, videos, and other materials with descriptions. Use them yourself or attach them in AI Studio when building courses."
      />
      <LibraryBrowser
        canPublishShared={isStaff(role)}
        initialAssets={result.assets ?? []}
      />
    </>
  );
}
