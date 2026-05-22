import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth-utils";
import { getLessonForPlayback } from "@/lib/repositories/training";
import { VideoPlayer } from "./VideoPlayer";

export default async function LessonPlayerPage({
  params,
}: {
  params: Promise<{ id: string; lessonId: string }>;
}) {
  const { id, lessonId } = await params;
  const session = await requireUser();
  const lesson = await getLessonForPlayback(lessonId, session.user.id);

  if (!lesson || lesson.module.course.slug !== id) notFound();

  const playbackId = lesson.videoAsset?.muxPlaybackId;

  return (
    <>
      <Link
        href={`/courses/${id}`}
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-storm-medium-blue no-underline hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to course
      </Link>

      <h1 className="font-title text-2xl font-bold text-storm-navy">
        {lesson.title}
      </h1>
      <p className="mt-1 text-sm text-storm-navy/60">
        {lesson.module.course.title}
      </p>

      <div className="mt-6 overflow-hidden rounded-xl bg-storm-navy">
        {playbackId ? (
          <VideoPlayer
            lessonId={lesson.id}
            playbackId={playbackId}
            initialSeconds={lesson.progress[0]?.watchedSeconds ?? 0}
          />
        ) : (
          <div className="flex aspect-video items-center justify-center text-storm-light-blue">
            <p>Video not yet uploaded. Check back soon.</p>
          </div>
        )}
      </div>
    </>
  );
}
