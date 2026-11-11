export function buildDocumentNotesFallback(text: string, fileName: string) {
  const lines = text
    .replace(/\r/g, "")
    .split(/\n+/)
    .map(line => line.replace(/\s+/g, " ").trim())
    .filter(line => line.length >= 18 && !/^loading\.{0,3}$/i.test(line));
  const uniqueLines = lines.filter((line, index) => index === 0 || line.toLowerCase() !== lines[index - 1].toLowerCase());
  const notes = uniqueLines.slice(0, 80);
  const summarySource = notes.slice(0, 3).join(" ");

  return {
    fileName,
    difficulty: "study-notes",
    summary: summarySource || `Study notes extracted from ${fileName}.`,
    notes: notes.length ? notes : ["The file was read successfully, but it did not contain enough continuous text for detailed notes."],
    questions: [],
    generatedBy: "document-fallback",
    notice: "Notes were organized directly from the uploaded document because the AI provider was temporarily unavailable.",
  };
}
