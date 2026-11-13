import { cn } from "@/lib/utils";

interface AuthCardProps {
  children: React.ReactNode;
  className?: string;
}

export function AuthCard({ children, className }: AuthCardProps) {
  return (
    <div
      className={cn(
        "w-full max-w-md font-nunito",
        "bg-[#fffaff] text-[#21152d] backdrop-blur-xl",
        "border border-[#c4a7ff] ring-1 ring-white/70",
        "rounded-3xl shadow-[0_24px_80px_rgba(8,5,15,.42)]",
        "px-5 py-7 sm:px-8 sm:py-8",
        className
      )}
    >
      {children}
    </div>
  );
}
