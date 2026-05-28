import { cn } from "@/lib/utils";
import { forwardRef } from "react";

/** Visible bordered file control with a styled “Choose file” button. */
export function fileInputClassName(className?: string) {
  return cn(
    "block w-full min-h-11 cursor-pointer rounded-lg border border-storm-light-blue/60 bg-white px-3 py-2 text-sm text-storm-navy/80",
    "file:mr-3 file:cursor-pointer file:rounded-md file:border file:border-storm-medium-blue file:bg-storm-light-blue file:px-4 file:py-2 file:text-sm file:font-semibold file:text-storm-navy file:transition-colors",
    "hover:file:bg-storm-medium-blue/15",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-storm-medium-blue/40",
    "disabled:cursor-not-allowed disabled:opacity-50",
    className,
  );
}

export const FileInput = forwardRef<
  HTMLInputElement,
  Omit<React.ComponentProps<"input">, "type">
>(function FileInput({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      type="file"
      className={fileInputClassName(className)}
      {...props}
    />
  );
});
