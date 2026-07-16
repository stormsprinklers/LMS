import { Award, Calendar, Download } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireUser } from "@/lib/auth-utils";
import { getCertificationsForUser } from "@/lib/repositories/certifications";
import type { Certification } from "@/lib/types";
import { formatDate } from "@/lib/utils";

const statusConfig: Record<
  Certification["status"],
  { label: string; variant: "success" | "warning" | "default" }
> = {
  earned: { label: "Certified", variant: "success" },
  in_progress: { label: "In progress", variant: "warning" },
  expired: { label: "Expired", variant: "default" },
};

export const metadata = { title: "Certifications" };

export default async function CertificationsPage() {
  const session = await requireUser();
  const certifications = await getCertificationsForUser(session.user.id);
  const earned = certifications.filter((c) => c.status === "earned");
  const inProgress = certifications.filter((c) => c.status === "in_progress");

  return (
    <>
      <PageHeader
        title="Certifications"
        description="Track earned credentials and certifications required for your role at Storm Sprinklers."
      />

      {earned.length > 0 && (
        <section className="mb-10">
          <h2 className="font-title mb-4 text-lg font-bold text-storm-navy">
            Earned certifications
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {earned.map((cert) => (
              <CertificationCard key={cert.id} cert={cert} />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="font-title mb-4 text-lg font-bold text-storm-navy">
          In progress
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {inProgress.map((cert) => (
            <CertificationCard key={cert.id} cert={cert} />
          ))}
        </div>
      </section>
    </>
  );
}

function CertificationCard({ cert }: { cert: Certification }) {
  const { label, variant } = statusConfig[cert.status];

  return (
    <Card className="relative overflow-hidden">
      <div className="absolute right-0 top-0 h-24 w-24 translate-x-8 -translate-y-4 rounded-full bg-storm-light-blue/40" />
      <div className="relative flex gap-4">
        {cert.badgeUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cert.badgeUrl}
            alt=""
            className="h-14 w-14 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-storm-navy text-storm-pink">
            <Award className="h-7 w-7" />
          </div>
        )}
        <div className="min-w-0">
          <Badge variant={variant}>{label}</Badge>
          <h3 className="font-title mt-2 font-bold text-storm-navy">{cert.title}</h3>
          {cert.description ? (
            <p className="mt-1 line-clamp-2 text-sm text-storm-navy/70">{cert.description}</p>
          ) : null}
          {cert.issuedAt && (
            <p className="mt-2 flex items-center gap-1 text-sm text-storm-navy/60">
              <Calendar className="h-4 w-4" />
              Issued {formatDate(cert.issuedAt)}
              {cert.expiresAt && ` · Expires ${formatDate(cert.expiresAt)}`}
            </p>
          )}
          {cert.status === "earned" && cert.pdfUrl ? (
            <a
              href={cert.pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-storm-medium-blue underline"
            >
              <Download className="h-4 w-4" />
              Download PDF
            </a>
          ) : null}
          {cert.status === "in_progress" && (
            <p className="mt-2 text-sm text-storm-medium-blue">
              Complete the linked course (and any required prerequisites) to earn this
              certification.
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
