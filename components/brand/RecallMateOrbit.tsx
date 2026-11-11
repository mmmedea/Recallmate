import { cn } from "@/lib/utils";

export function RecallMateOrbit({
  className,
  reverse = false,
}: {
  className?: string;
  reverse?: boolean;
}) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute rounded-[1.1rem] border border-violet-300/20",
        reverse ? "inset-3 rm-orbit-reverse border-fuchsia-300/15" : "inset-1.5 rm-orbit",
        className
      )}
      aria-hidden="true"
    >
      {reverse ? (
        <span className="absolute left-0 top-2 h-1.5 w-1.5 rounded-full bg-white/90 shadow-[0_0_10px_rgba(255,255,255,0.7)]" />
      ) : (
        <>
          <span className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-violet-300 shadow-[0_0_12px_rgba(167,139,250,0.9)]" />
          <span className="absolute bottom-1 right-0 h-1.5 w-1.5 rounded-full bg-fuchsia-300 shadow-[0_0_10px_rgba(240,171,252,0.8)]" />
        </>
      )}
    </div>
  );
}
