export function SaveStateBadge({
  state,
}: {
  state: "idle" | "saving" | "saved" | "error";
}) {
  if (state === "idle") return null;
  const text =
    state === "saving"
      ? "Saving…"
      : state === "saved"
        ? "Saved"
        : "Error saving";
  const cls =
    state === "error"
      ? "bg-red-100 text-red-800"
      : state === "saving"
        ? "bg-storm-light-grey text-storm-navy/70"
        : "bg-green-100 text-green-800";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{text}</span>
  );
}
