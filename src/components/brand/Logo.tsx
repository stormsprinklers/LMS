import Image from "next/image";
import { cn } from "@/lib/utils";

const LOGO_SRC = "/brand/storm-sprinklers-logo-transparent.png";

type LogoProps = {
  className?: string;
  width?: number;
  height?: number;
  priority?: boolean;
  showText?: boolean;
};

export function Logo({
  className,
  width = 56,
  height = 56,
  priority = false,
  showText = false,
}: LogoProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <Image
        src={LOGO_SRC}
        alt="Storm Sprinklers"
        width={width}
        height={height}
        priority={priority}
        unoptimized
        className="h-auto w-auto object-contain bg-transparent"
        style={{ maxWidth: width, maxHeight: height }}
      />
      {showText && (
        <div>
          <p className="font-title text-sm font-bold leading-tight text-inherit">
            Storm Sprinklers
          </p>
          <p className="text-xs opacity-80">Employee Learning</p>
        </div>
      )}
    </div>
  );
}

export function LogoMark({
  className,
  size = 120,
  priority = false,
}: {
  className?: string;
  size?: number;
  priority?: boolean;
}) {
  return (
    <Image
      src={LOGO_SRC}
      alt="Storm Sprinklers"
      width={size}
      height={size}
      priority={priority}
      unoptimized
      className={cn("mx-auto object-contain bg-transparent", className)}
    />
  );
}
