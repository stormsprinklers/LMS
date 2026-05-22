import { PageHeader } from "@/components/ui/PageHeader";
import { AdminArchivedLink } from "@/components/admin/AdminArchivedLink";
import { AdminListCard } from "@/components/admin/AdminListCard";
import { prisma } from "@/lib/db";
import { ManualUploadForm } from "./ManualUploadForm";
import { VideoUploadForm } from "./VideoUploadForm";

export const metadata = { title: "Admin — Media" };

export default async function AdminMediaPage() {
  const [manuals, videoLessons] = await Promise.all([
    prisma.manualAsset.findMany({
      where: { archived: false },
      orderBy: { title: "asc" },
    }),
    prisma.lesson.findMany({
      where: { type: "VIDEO", archived: false },
      include: { videoAsset: true, module: { include: { course: true } } },
    }),
  ]);

  const firstManual = manuals[0];

  return (
    <>
      <PageHeader
        title="Media library"
        description="Upload PDF manuals and configure Mux video uploads for lessons."
        action={<AdminArchivedLink />}
      />
      <section className="mb-10">
        <h2 className="font-title mb-3 font-bold text-storm-navy">PDF manuals</h2>
        <ul className="mb-4 space-y-3">
          {manuals.map((m) => (
            <AdminListCard
              key={m.id}
              title={m.title}
              subtitle={m.blobUrl ? "Uploaded" : "Pending upload"}
              type="manual"
              id={m.id}
            />
          ))}
          {manuals.length === 0 && (
            <p className="text-sm text-storm-navy/60">No active manuals.</p>
          )}
        </ul>
        {firstManual && <ManualUploadForm manualId={firstManual.id} />}
      </section>
      <section>
        <h2 className="font-title mb-3 font-bold text-storm-navy">Video lessons</h2>
        <ul className="space-y-4">
          {videoLessons.map((l) => (
            <li key={l.id} className="space-y-3">
              <AdminListCard
                as="div"
                title={l.title}
                subtitle={`${l.module.course.title} · Mux: ${l.videoAsset?.muxPlaybackId ?? "not configured"}`}
                type="lesson"
                id={l.id}
              />
              <div className="rounded-xl border bg-white p-4">
                <VideoUploadForm lessonId={l.id} />
              </div>
            </li>
          ))}
          {videoLessons.length === 0 && (
            <p className="text-sm text-storm-navy/60">No active video lessons.</p>
          )}
        </ul>
      </section>
    </>
  );
}
