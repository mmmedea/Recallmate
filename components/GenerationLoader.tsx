import RecallMateLoader, { type RecallMateLoaderStep } from "@/components/brand/RecallMateLoader";

const DEFAULT_STEPS = [
  "Extracting text from the original file",
  "Mapping headings, bullets, tables, and images",
  "Building source-grounded quiz questions",
  "Checking output quality before opening",
];

export default function GenerationLoader({
  title = "Medea is preparing your study material",
  subtitle = "Reading the source, preserving structure, and checking the output before it opens.",
  status,
  steps = DEFAULT_STEPS,
  currentStep,
  percent,
}: {
  title?: string;
  subtitle?: string;
  status?: string;
  steps?: RecallMateLoaderStep[];
  currentStep?: number;
  percent?: number;
}) {
  return (
    <RecallMateLoader
      title={title}
      subtitle={subtitle}
      status={status}
      steps={steps}
      currentStep={currentStep}
      percent={percent}
    />
  );
}
