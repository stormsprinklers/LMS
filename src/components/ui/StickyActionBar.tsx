export function StickyActionBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky bottom-0 z-20 -mx-4 border-t border-storm-light-blue/60 bg-white/95 px-4 py-3 backdrop-blur-sm md:-mx-6 md:px-6 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      {children}
    </div>
  );
}
