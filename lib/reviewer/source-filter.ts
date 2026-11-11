export type ReviewerContentDisposition =
  | "KEEP"
  | "DROP_OBJECTIVES"
  | "DROP_CLOSING"
  | "DROP_DECORATIVE"
  | "DROP_ADMIN"
  | "REVIEW";

const OBJECTIVE_HEADER = /^(?:course(?:\s+(?:overview|outline|information|details|syllabus))?|learning\s+(?:outcomes?|objectives?)|lesson\s+objectives?|study\s+objectives?|at\s+the\s+end\s+of\s+(?:this\s+)?(?:lesson|lecture)|today\s+we\s+will\s+learn)(?:\s|$)/i;
const CLOSING_HEADER = /^(?:thank\s+you[!.]?|questions\??|q\s*&\s*a)(?:\s|$)/i;
const ADMIN_HEADER = /^(?:welcome|agenda|introduction|contact\s+(?:me|information)|presenter\s+contact)(?:\s|$)/i;
const ACADEMIC_SIGNAL = /\b(?:formula|equation|normal|range|value|principle|mechanism|definition|classification|procedure|steps?|process|comparison|advantage|disadvantage|warning|exception|clinical|laboratory|microscope|objective lens|spectro|colorimetry|hematology|urinalysis|cell|tissue|analyte|instrument|reagent|diagnos|pathway|enzyme|hormone|protein|acid|base|\d+(?:\.\d+)?\s*(?:%|mg\/dL|g\/dL|fL|pg|mL|nm)?)\b/i;

export function classifyReviewerSectionDisposition(text: string): ReviewerContentDisposition {
  const lines = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
  const firstMeaningfulLine = lines[0] ?? "";
  const body = lines.slice(1).join("\n");

  if (OBJECTIVE_HEADER.test(firstMeaningfulLine)) return "DROP_OBJECTIVES";
  if (CLOSING_HEADER.test(firstMeaningfulLine)) return "DROP_CLOSING";
  if (ADMIN_HEADER.test(firstMeaningfulLine)) {
    return ACADEMIC_SIGNAL.test(body) ? "KEEP" : "DROP_ADMIN";
  }
  return "KEEP";
}

export function shouldExcludeReviewerSection(text: string) {
  return classifyReviewerSectionDisposition(text) !== "KEEP";
}
