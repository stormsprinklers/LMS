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
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-title text-2xl font-bold tracking-tight text-storm-navy sm:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-2xl text-sm text-storm-navy/70 sm:text-base">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}
