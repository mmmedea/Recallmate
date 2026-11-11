import Image from "next/image";
import { cn } from "@/lib/utils";
import { RecallMateOrbit } from "@/components/brand/RecallMateOrbit";

const sizeClasses = {
  xs: "h-6 w-6 rounded-lg",
  sm: "h-8 w-8 rounded-xl",
  md: "h-11 w-11 rounded-2xl",
  lg: "h-[72px] w-[72px] rounded-[1.45rem]",
  xl: "h-28 w-28 rounded-[2rem]",
} as const;

const wordmarkClasses = {
  xs: "text-sm",
  sm: "text-base",
  md: "text-lg",
  lg: "text-2xl",
  xl: "text-3xl",
} as const;

export function RecallMateBrandLogo({
  className,
  animated = true,
  showWordmark = false,
  size = "md",
  alt,
}: {
  className?: string;
  animated?: boolean;
  showWordmark?: boolean;
  size?: keyof typeof sizeClasses;
  alt?: string;
}) {
  return (
    <div className={cn("inline-flex items-center gap-3", className)}>
      <div
        className={cn(
          "relative grid shrink-0 place-items-center overflow-visible border border-violet-200/30 bg-slate-950 shadow-lg shadow-violet-500/20",
          sizeClasses[size],
          animated && "rm-breathe rm-shine"
        )}
        aria-hidden="true"
      >
        {animated && <RecallMateOrbit />}
        {animated && <RecallMateOrbit reverse />}
        <Image
          src="/recallmate-logo-ui.png"
          alt={alt ?? (showWordmark ? "" : "RecallMate")}
          width={1024}
          height={1024}
          priority={size === "lg" || size === "xl"}
          className={cn("relative z-10 h-full w-full rounded-[inherit] object-cover", animated && "rm-logo-core")}
          sizes={size === "xs" ? "24px" : size === "sm" ? "32px" : size === "md" ? "44px" : size === "lg" ? "72px" : "112px"}
        />
      </div>
      {showWordmark && (
        <span className={cn("font-black tracking-tight text-slate-950 dark:text-white", wordmarkClasses[size])}>
          RecallMate
        </span>
      )}
    </div>
  );
}

export const RecallMateLogo = RecallMateBrandLogo;
