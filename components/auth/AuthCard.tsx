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
        "bg-[#17111f]/95 backdrop-blur-xl",
        "border border-[#a78bfa]/30",
        "rounded-[2rem] shadow-[0_24px_80px_rgba(0,0,0,.48)]",
        "px-5 py-8 sm:px-8 sm:py-10",
        className
      )}
    >
      {children}
    </div>
  );
}
