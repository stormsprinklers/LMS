import { cn } from "@/lib/utils";

export function Card({
  children,
  className,
  href,
}: {
  children: React.ReactNode;
  className?: string;
  href?: string;
}) {
  const classes = cn(
    "rounded-xl border border-storm-light-blue/60 bg-white p-5 shadow-sm transition-shadow hover:shadow-md",
    className,
  );

  if (href) {
    return (
      <a href={href} className={cn(classes, "block no-underline text-inherit")}>
        {children}
      </a>
    );
  }

  return <div className={classes}>{children}</div>;
}
