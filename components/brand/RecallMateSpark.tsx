import { cn } from "@/lib/utils";

export function RecallMateSpark({
  className,
  animated = true,
  title,
}: {
  className?: string;
  animated?: boolean;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("h-4 w-4 text-violet-400", animated && "rm-spark", className)}
      role={title ? "img" : "presentation"}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <path
        d="M12 2.75c.74 4.18 2.97 6.51 7.25 7.25-4.28.74-6.51 3.07-7.25 7.25-.74-4.18-2.97-6.51-7.25-7.25 4.28-.74 6.51-3.07 7.25-7.25Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M18 15.5c.32 1.8 1.28 2.8 3.1 3.1-1.82.32-2.78 1.31-3.1 3.15-.32-1.84-1.28-2.83-3.1-3.15 1.82-.3 2.78-1.3 3.1-3.1Z"
        fill="currentColor"
        opacity="0.75"
      />
    </svg>
  );
}
