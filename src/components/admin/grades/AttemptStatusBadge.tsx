import { Badge } from "@/components/ui/Badge";
import {
  attemptStatusLabel,
  attemptStatusVariant,
} from "@/lib/exams/attempt-status";

export function AttemptStatusBadge({ status }: { status: string }) {
  if (status === "—") {
    return <span className="text-storm-navy/40">—</span>;
  }
  return (
    <Badge variant={attemptStatusVariant(status)}>
      {attemptStatusLabel(status)}
    </Badge>
  );
}
