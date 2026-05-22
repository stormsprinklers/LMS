export function StickyActionBar({
  children,
  fixed = false,
}: {
  children: React.ReactNode;
  /** Pin to viewport bottom (exam submit, etc.) */
  fixed?: boolean;
}) {
  const base =
    "z-30 border-t border-storm-light-blue/60 bg-white/95 px-4 py-3 backdrop-blur-sm pb-[max(0.75rem,env(safe-area-inset-bottom))]";
  if (fixed) {
    return (
      <div
        className={`fixed bottom-0 left-0 right-0 ${base} md:left-64`}
      >
        <div className="mx-auto max-w-4xl px-0 md:px-2">{children}</div>
      </div>
    );
  }
  return (
    <div
      className={`sticky bottom-0 z-20 -mx-4 md:-mx-6 md:px-6 ${base}`}
    >
      {children}
    </div>
  );
}
