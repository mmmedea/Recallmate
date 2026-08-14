import { TutorStatusPhase } from "@/lib/ai/tutor/stream";
import { Loader2, CheckCircle2 } from "lucide-react";

export function TutorStatus({ phase, label }: { phase: TutorStatusPhase; label: string }) {
  if (phase === "finalizing") {
    return null; // Hide when finalizing
  }

  return (
    <div 
      className="flex items-center gap-2 py-2 px-3 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 rounded-lg w-fit text-sm font-medium animate-in fade-in slide-in-from-bottom-2 duration-300"
    >
      <Loader2 className="w-4 h-4 animate-spin" />
      <span aria-hidden="true">{label}</span>
    </div>
  );
}

export function VerificationIndicator({ 
  verified, 
  checks 
}: { 
  verified: boolean; 
  checks: { calculation?: boolean; units?: boolean; dimensionality?: boolean; } 
}) {
  if (!verified) {
    return (
      <div className="flex items-center gap-2 py-2 text-sm font-medium text-amber-600 dark:text-amber-500">
        <span className="sr-only">Status: </span>
        <span>⚠ Verification unavailable</span>
      </div>
    );
  }

  const hasChecks = checks.calculation || checks.units || checks.dimensionality;
  if (!hasChecks) return null; // Calm UI: hide if nothing meaningful to verify

  return (
    <div className="flex flex-wrap gap-3 py-2 text-xs font-medium text-emerald-600 dark:text-emerald-500">
      <span className="sr-only">Status: </span>
      {checks.calculation && (
        <span className="flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
          Calculation checked
        </span>
      )}
      {(checks.units || checks.dimensionality) && (
        <span className="flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
          Units checked
        </span>
      )}
    </div>
  );
}

export function CitationBadge({ label, page }: { label: string; page?: number }) {
  return (
    <button 
      className="inline-flex items-center justify-center gap-1 px-3 min-h-[44px] text-xs font-semibold text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      aria-label={`View source: ${label}${page ? ` page ${page}` : ''}`}
    >
      {label} {page && `· p. ${page}`}
    </button>
  );
}
