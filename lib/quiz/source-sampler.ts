const MAX_QUIZ_SOURCE_CHARS = 12_000;
const SAMPLE_SEGMENT_COUNT = 11;
const SAMPLE_SEPARATOR = "\n\n";

/**
 * Keep the provider input bounded while sampling across the entire source,
 * rather than silently discarding everything after the first pages.
 */
export function sampleQuizSourceText(sourceText: string, maxChars = MAX_QUIZ_SOURCE_CHARS) {
  const source = sourceText.trim();
  if (source.length <= maxChars) return source;
  if (maxChars <= 0) return "";

  const segmentLength = Math.floor(
    (maxChars - SAMPLE_SEPARATOR.length * (SAMPLE_SEGMENT_COUNT - 1)) / SAMPLE_SEGMENT_COUNT,
  );
  if (segmentLength <= 0) return source.slice(0, maxChars);

  const lastValidStart = source.length - segmentLength;
  const segments = Array.from({ length: SAMPLE_SEGMENT_COUNT }, (_, index) => {
    const start = Math.round(index * lastValidStart / (SAMPLE_SEGMENT_COUNT - 1));
    return source.slice(start, start + segmentLength);
  });

  return segments.join(SAMPLE_SEPARATOR).slice(0, maxChars);
}
