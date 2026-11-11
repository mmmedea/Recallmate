import { CheckCircle2, Circle } from "lucide-react";
import { DiamondLoader } from "@/components/DiamondLoader";
import { cn } from "@/lib/utils";

export type RecallMateLoaderStep = string | { label: string; match?: string[] };

function stepLabel(step: RecallMateLoaderStep) {
  return typeof step === "string" ? step : step.label;
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function inferCurrentStep(steps: RecallMateLoaderStep[], status?: string) {
  if (!steps.length) return 0;
  if (!status) return 0;

  const normalizedStatus = normalize(status);
  const index = steps.findIndex((step) => {
    const label = stepLabel(step);
    const terms = typeof step === "string" ? [label] : [label, ...(step.match || [])];
    return terms.some((term) => {
      const normalizedTerm = normalize(term);
      if (!normalizedTerm) return false;
      return normalizedStatus.includes(normalizedTerm) || normalizedTerm.split(" ").some((word) => word.length > 4 && normalizedStatus.includes(word));
    });
  });

  return index >= 0 ? index : 0;
}

export default function RecallMateLoader({
  title = "Medea is preparing your study material",
  subtitle = "Reading the source, preserving structure, and checking the output before it opens.",
  status,
  steps = [],
  currentStep,
  percent,
  compact = false,
}: {
  title?: string;
  subtitle?: string;
  status?: string;
  steps?: RecallMateLoaderStep[];
  currentStep?: number;
  percent?: number;
  compact?: boolean;
}) {
  const activeStep = Math.max(0, Math.min(steps.length - 1, currentStep ?? inferCurrentStep(steps, status)));
  const hasRealPercent = typeof percent === "number" && Number.isFinite(percent);

  return (
    <DiamondLoader
      variant="section"
      label={title}
      sublabel={status || subtitle}
      className={cn(
        "rm-entrance mx-auto rounded-[2rem] border border-white/10 bg-slate-950/95 text-center shadow-2xl shadow-violet-500/10",
        compact ? "max-w-xs p-6" : "max-w-md p-8 sm:p-10",
      )}
    >
      <p className="mb-4 bg-gradient-to-r from-violet-300 to-fuchsia-300 bg-clip-text text-xs font-black uppercase tracking-[0.42em] text-transparent">
        Recall Core
      </p>
      {hasRealPercent && (
        <div className="mt-5 w-full">
          <div className="mb-2 flex items-center justify-between text-xs font-bold text-slate-300">
            <span>Known progress</span>
            <span>{Math.max(0, Math.min(100, Math.round(percent)))}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-400 to-fuchsia-400 transition-[width] duration-300"
              style={{ width: `${Math.max(0, Math.min(100, Math.round(percent)))}%` }}
            />
          </div>
        </div>
      )}

      {steps.length > 0 && (
        <div className={cn("w-full space-y-3", compact ? "pt-5" : "pt-6")}>
          {steps.map((step, idx) => {
            const done = idx < activeStep;
            const active = idx === activeStep;
            return (
              <div
                key={`${stepLabel(step)}-${idx}`}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border p-3 text-left text-xs font-semibold transition-colors",
                  done && "border-emerald-400/25 bg-emerald-500/10 text-emerald-100",
                  active && "border-violet-400/35 bg-violet-500/10 text-violet-100",
                  !done && !active && "border-white/5 bg-white/[0.03] text-slate-500"
                )}
              >
                {done ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
                ) : active ? (
                  <DiamondLoader variant="inline" decorative label={`Working on ${stepLabel(step)}`} />
                ) : (
                  <Circle className="h-4 w-4 shrink-0" />
                )}
                <span>{stepLabel(step)}</span>
              </div>
            );
          })}
        </div>
      )}
    </DiamondLoader>
  );
}
