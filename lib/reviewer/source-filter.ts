const EXCLUDED_ADMIN_SLIDE = /^(?:course(?:\s+(?:overview|outline|information|details|syllabus))?|learning\s+(?:outcomes?|objectives?)|lesson\s+objectives?|thank\s+you[!.]?)(?:\s|$)/i;

export function shouldExcludeReviewerSection(text: string) {
  const firstMeaningfulLine = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .find(Boolean) ?? "";

  return EXCLUDED_ADMIN_SLIDE.test(firstMeaningfulLine);
}
