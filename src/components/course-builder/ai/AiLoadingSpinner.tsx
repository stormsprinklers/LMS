export function AiLoadingSpinner({ label }: { label?: string }) {
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
        <p className="max-w-md text-center text-sm text-storm-navy/70">{label}</p>
      ) : (
        <span className="sr-only">Loading</span>
      )}
    </div>
  );
}
