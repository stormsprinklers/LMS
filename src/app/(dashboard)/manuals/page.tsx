import { Download, FileText } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireUser } from "@/lib/auth-utils";
import { getManuals } from "@/lib/repositories/manuals";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Manuals" };

export default async function ManualsPage() {
  await requireUser();
  const manuals = await getManuals();

  return (
    <>
      <PageHeader
        title="Manuals & Guides"
        description="Reference documentation for field operations, equipment, and safety procedures."
      />

      <div className="space-y-3">
        {manuals.map((manual) => (
          <Card key={manual.id} className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-storm-light-blue text-storm-navy">
              <FileText className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="info">{manual.category}</Badge>
                <span className="text-xs text-storm-navy/50">
                  v{manual.version} · Updated {formatDate(manual.updatedAt)}
                </span>
              </div>
              <h3 className="font-title mt-1 font-bold text-storm-navy">
                {manual.title}
              </h3>
              <p className="text-sm text-storm-navy/60">{manual.pageCount} pages</p>
            </div>
            <div className="flex shrink-0 gap-2">
              {manual.blobUrl ? (
                <>
                  <a
                    href={manual.blobUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-storm-medium-blue px-4 py-2 text-sm font-semibold text-storm-medium-blue no-underline transition-colors hover:bg-storm-light-blue/30"
                  >
                    View
                  </a>
                  <a
                    href={manual.blobUrl}
                    download
                    className="inline-flex items-center gap-2 rounded-lg bg-storm-navy px-4 py-2 text-sm font-semibold text-white no-underline transition-opacity hover:opacity-90"
                  >
                    <Download className="h-4 w-4" />
                    PDF
                  </a>
                </>
              ) : (
                <span className="text-sm text-storm-navy/50">PDF pending upload</span>
              )}
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
