import { PageHeader } from "@/components/ui/PageHeader";
import { prisma } from "@/lib/db";
import { ManualUploadForm } from "./ManualUploadForm";
import { VideoUploadForm } from "./VideoUploadForm";

export const metadata = { title: "Admin — Media" };

export default async function AdminMediaPage() {
  const [manuals, videoLessons] = await Promise.all([
    prisma.manualAsset.findMany({ orderBy: { title: "asc" } }),
    prisma.lesson.findMany({
      where: { type: "VIDEO" },
      include: { videoAsset: true, module: { include: { course: true } } },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Media library"
        description="Upload PDF manuals and configure Mux video uploads for lessons."
      />
      <section className="mb-10">
        <h2 className="font-title mb-3 font-bold text-storm-navy">PDF manuals</h2>
        <ul className="mb-4 space-y-2 text-sm">
          {manuals.map((m) => (
            <li key={m.id} className="rounded border bg-white px-3 py-2">
              {m.title} {m.blobUrl ? "✓ uploaded" : "— pending"}
            </li>
          ))}
        </ul>
        {manuals[0] && <ManualUploadForm manualId={manuals[0].id} />}
      </section>
      <section>
        <h2 className="font-title mb-3 font-bold text-storm-navy">Video lessons</h2>
        <ul className="space-y-4">
          {videoLessons.map((l) => (
            <li key={l.id} className="rounded-xl border bg-white p-4">
              <p className="font-medium text-storm-navy">{l.title}</p>
              <p className="text-xs text-storm-navy/60">{l.module.course.title}</p>
              <p className="mt-1 text-xs">
                Mux: {l.videoAsset?.muxPlaybackId ?? "not configured"}
              </p>
              <VideoUploadForm lessonId={l.id} />
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
