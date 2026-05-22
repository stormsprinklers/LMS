import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 md:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="font-title text-xl font-bold tracking-tight text-storm-navy sm:text-2xl md:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-2xl text-sm text-storm-navy/70 sm:text-base">
            {description}
          </p>
        )}
      </div>
      {action && (
        <div className={cn("shrink-0 [&_a]:inline-flex [&_a]:min-h-11 [&_a]:w-full [&_a]:items-center [&_a]:justify-center [&_a]:sm:w-auto [&_button]:min-h-11 [&_button]:w-full [&_button]:sm:w-auto")}>
          {action}
        </div>
      )}
    </div>
  );
}
