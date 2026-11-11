import { RecallMateLogo } from "@/components/brand/RecallMateLogo";
import { RecallMateSpark } from "@/components/brand/RecallMateSpark";
import { cn } from "@/lib/utils";

export function RecallMateLogoReveal({
  className,
  caption = "Preparing your workspace",
}: {
  className?: string;
  caption?: string;
}) {
  return (
    <div className={cn("grid place-items-center text-center", className)} role="status" aria-live="polite">
      <div className="rm-reveal-settle relative grid place-items-center">
        <RecallMateSpark className="rm-reveal-spark absolute -top-6 h-5 w-5 text-violet-300" animated={false} />
        <div className="rm-reveal-mark">
          <RecallMateLogo animated showWordmark={false} />
        </div>
      </div>
      <div className="rm-reveal-wordmark mt-5 space-y-1">
        <p className="text-xl font-black tracking-tight text-slate-950 dark:text-white">RecallMate</p>
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-violet-500 dark:text-violet-300">{caption}</p>
      </div>
    </div>
  );
}
