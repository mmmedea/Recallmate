import { cn } from "@/lib/utils";

interface AuthCardProps {
  children: React.ReactNode;
  className?: string;
}

export function AuthCard({ children, className }: AuthCardProps) {
  return (
    <section
      className={cn(
        "relative isolate w-full max-w-lg overflow-hidden font-nunito",
        "rounded-[2rem] border border-[#d8c5ff] bg-[#fffaff] text-[#21152d]",
        "shadow-[0_28px_90px_rgba(8,5,15,.5)] ring-1 ring-white/70",
        "px-5 py-7 sm:px-9 sm:py-9",
        "before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-1.5 before:bg-gradient-to-r before:from-[#17101f] before:via-[#b99aff] before:to-[#ff596f]",
        className
      )}
    >
      <div className="pointer-events-none absolute -right-20 -top-24 -z-10 h-48 w-48 rounded-full bg-[#c4a7ff]/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-20 -z-10 h-48 w-48 rounded-full bg-[#ff7185]/10 blur-3xl" />
      {children}
    </section>
  );
}
