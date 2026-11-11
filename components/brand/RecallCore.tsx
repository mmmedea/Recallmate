import { RecallMateBrandLogo } from "@/components/brand/RecallMateLogo";
import { cn } from "@/lib/utils";

export function RecallCore({
  className,
  size = "lg",
}: {
  className?: string;
  size?: "md" | "lg" | "xl";
}) {
  return (
    <div className={cn("rm-core relative grid place-items-center", className)} aria-hidden="true">
      <span className="rm-core-orbit rm-core-orbit-outer" />
      <span className="rm-core-orbit rm-core-orbit-inner" />
      <span className="rm-core-scan" />
      <span className="rm-core-particle rm-core-particle-a" />
      <span className="rm-core-particle rm-core-particle-b" />
      <span className="rm-core-particle rm-core-particle-c" />
      <RecallMateBrandLogo size={size} animated={false} />
    </div>
  );
}
