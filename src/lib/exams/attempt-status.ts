type BadgeVariant = "default" | "success" | "warning" | "info" | "pink";

export function attemptStatusLabel(status: string): string {
  switch (status) {
    case "PASSED":
      return "Passed";
    case "FAILED":
      return "Failed";
    case "SUBMITTED_PENDING_GRADE":
      return "Pending review";
    case "IN_PROGRESS":
      return "In progress";
    default:
      return status.replace(/_/g, " ");
  }
}

export function attemptStatusVariant(status: string): BadgeVariant {
  switch (status) {
    case "PASSED":
      return "success";
    case "FAILED":
      return "pink";
    case "SUBMITTED_PENDING_GRADE":
      return "warning";
    case "IN_PROGRESS":
      return "info";
    default:
      return "default";
  }
}
