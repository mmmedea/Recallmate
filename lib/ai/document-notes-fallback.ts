import { notesFromSource, sourceFromText } from '@/lib/source/academic-source';

export function buildDocumentNotesFallback(text: string, fileName: string) {
  const preserved = notesFromSource(sourceFromText(text.replace(/^loading\.{0,3}$/gim, ''), fileName));
  return {
    ...preserved,
    difficulty: "study-notes",
    generatedBy: "document-fallback",
    notice: "Notes were organized directly from the uploaded document. No outside information was added.",
  };
}
