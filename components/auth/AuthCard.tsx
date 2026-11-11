import { cn } from "@/lib/utils";

interface AuthCardProps {
  children: React.ReactNode;
  className?: string;
}

export function AuthCard({ children, className }: AuthCardProps) {
  return (
    <div
      className={cn(
        "w-full max-w-md",
        "bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm",
        "border border-slate-200/80 dark:border-slate-800/80",
        "rounded-2xl shadow-xl shadow-slate-200/60 dark:shadow-slate-950/60",
        "px-8 py-10",
        className
      )}
    >
      {children}
    </div>
  );
}
