import Link from "next/link";
import { PlayCircle } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { requireUser } from "@/lib/auth-utils";
import { getVideoTrainingsForUser } from "@/lib/repositories/training";

export const metadata = { title: "Video Training" };

export default async function TrainingPage() {
  const session = await requireUser();
  const videos = await getVideoTrainingsForUser(session.user.id);

  return (
    <>
      <PageHeader
        title="Video Training"
        description="Watch step-by-step training videos tied to your assigned courses."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {videos.map((video) => (
          <Card key={video.id}>
            <div className="flex gap-4">
              <div className="flex h-24 w-36 shrink-0 items-center justify-center rounded-lg bg-storm-navy text-storm-light-blue">
                <PlayCircle className="h-10 w-10" />
              </div>
              <div className="min-w-0 flex-1">
                <Badge variant="info">{video.courseTitle}</Badge>
                <h3 className="font-title mt-2 font-bold text-storm-navy">
                  {video.title}
                </h3>
                <p className="mt-1 text-sm text-storm-navy/60">
                  {video.durationMinutes} minutes
                </p>
                <div className="mt-3">
                  <ProgressBar
                    value={video.watchedPercent}
                    label={
                      video.watchedPercent === 100
                        ? "Completed"
                        : "Watch progress"
                    }
                  />
                </div>
                <Link
                  href={`/courses/${video.courseId}/lessons/${video.id}`}
                  className="mt-3 inline-block text-sm font-semibold text-storm-medium-blue no-underline hover:underline"
                >
                  {video.watchedPercent > 0 ? "Resume video" : "Start video"}
                </Link>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
