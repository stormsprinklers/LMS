export function AiLoadingSpinner({
  label,
  timeEstimate,
}: {
  label?: string;
  timeEstimate?: string;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 py-10"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div
        className="h-10 w-10 animate-spin rounded-full border-2 border-storm-light-blue/80 border-t-storm-medium-blue"
        aria-hidden
      />
      {label ? (
        <div className="max-w-md space-y-1 text-center">
          <p className="text-sm text-storm-navy/70">{label}</p>
          {timeEstimate ? (
            <p className="text-xs text-storm-navy/50">{timeEstimate}</p>
          ) : null}
        </div>
      ) : (
        <span className="sr-only">Loading</span>
      )}
    </div>
  );
}
