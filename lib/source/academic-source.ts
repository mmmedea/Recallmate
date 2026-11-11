export type SourceClass = 'academic_content' | 'definition' | 'table' | 'learning_objective' | 'study_instruction' | 'reviewer_metadata' | 'title';
export type SourceRun = { text: string; bold?: boolean; italic?: boolean };
export type SourceCell = { row: number; column: number; rowSpan: number; colSpan: number; header: boolean; paragraphs: SourceRun[][] };
export type SourceBlock = {
  id: string; order: number; kind: 'heading' | 'paragraph' | 'list_item' | 'table'; classification: SourceClass;
  text: string; runs: SourceRun[]; level?: number; ordered?: boolean; section: string[]; cells?: SourceCell[][];
};
export type AcademicSource = {
  version: 1; document_id: string; source_hash: string; fileName: string; document_type: 'reviewer' | 'lecture_notes';
  blocks: SourceBlock[]; unresolved: string[];
};

export const reviewerMetadataPattern = /\b(purpose of (?:this|the) reviewer|study focus|useful sentence starter|review the following|this lesson covers|how to use (?:this|the) reviewer)\b/i;
const instructionPattern = /^(?:study focus\s*:|this reviewer (?:presents|is |covers)|review the (?:definitions|following)|the following distinctions organize|for (?:information technology|computer science) (?:and computer science )?students\b|preliminary examination coverage\b)/i;
export const isStudyInstruction = (text: string) => instructionPattern.test(text.trim()) || reviewerMetadataPattern.test(text);

export function notesEligible(block: SourceBlock) {
  return !['reviewer_metadata', 'study_instruction', 'title'].includes(block.classification);
}
export function quizEligible(block: SourceBlock) {
  return notesEligible(block) && block.kind !== 'heading' && block.classification !== 'learning_objective';
}
export function sourceAcademicText(source: AcademicSource, forQuiz = false) {
  return source.blocks.filter(forQuiz ? quizEligible : notesEligible).map(block => {
    if (block.cells) return block.cells.map(row => row.map(cell => cell.paragraphs.map(p => p.map(r => r.text).join('')).join('\n')).join(' | ')).join('\n');
    return `${block.kind === 'heading' ? '#'.repeat(block.level || 2) + ' ' : block.kind === 'list_item' ? '- ' : ''}${block.text}`;
  }).join('\n\n');
}

// Conservative text adapter for non-DOCX/older imports. No claimed DOCX geometry.
export function sourceFromText(text: string, fileName: string, documentId = 'ephemeral-source'): AcademicSource {
  let metaSection = false;
  const blocks: SourceBlock[] = [];
  for (const line of text.replace(/\r/g, '').split(/\n+/).map(s => s.trim()).filter(Boolean)) {
    const heading = /^#{1,6}\s/.test(line) || (line.length < 100 && /^[A-Z][A-Z\d /&-]+$/.test(line));
    const clean = line.replace(/^#{1,6}\s*/, '');
    if (heading) metaSection = /^(?:purpose of (?:this|the) reviewer|study focus|how to use)/i.test(clean);
    blocks.push({ id: `text-${blocks.length}`, order: blocks.length, kind: heading ? 'heading' : 'paragraph',
      classification: metaSection ? 'reviewer_metadata' : isStudyInstruction(clean) ? 'study_instruction' : 'academic_content',
      text: clean, runs: [{ text: clean }], section: [], level: heading ? 2 : undefined });
  }
  return { version: 1, document_id: documentId, source_hash: '', fileName, document_type: /reviewer/i.test(fileName) ? 'reviewer' : 'lecture_notes', blocks, unresolved: [] };
}

const escape = (s: string) => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const renderRuns = (runs: SourceRun[]) => runs.map(r => {
  let text = escape(r.text).replace(/\n/g, '<br>');
  if (r.bold) text = `<strong>${text}</strong>`;
  if (r.italic) text = `<em>${text}</em>`;
  return text;
}).join('');

// Notes are an exact structural projection, not an unverified paraphrase.
export function notesFromSource(source: AcademicSource) {
  const blocks = source.blocks.filter(notesEligible);
  const noteBlocks = blocks.map(block => ({ document_id: source.document_id, source_block_ids: [block.id], block }));
  const html = [`<h1>Study Notes</h1><p>Based on: ${escape(source.fileName)}</p>`];
  let list: { ordered: boolean; level: number } | null = null;
  const closeList = () => { if (list) html.push(list.ordered ? '</ol>' : '</ul>'); list = null; };
  for (const block of blocks) {
    const attrs = `data-source-block="${escape(block.id)}" data-document-id="${escape(source.document_id)}"`;
    if (block.kind === 'list_item') {
      if (list?.ordered !== !!block.ordered || list?.level !== (block.level || 0)) {
        closeList(); list = { ordered: !!block.ordered, level: block.level || 0 };
        html.push(`<${list.ordered ? 'ol' : 'ul'} data-list-level="${list.level}">`);
      }
      html.push(`<li ${attrs}>${renderRuns(block.runs)}</li>`);
      continue;
    }
    closeList();
    if (block.cells) {
      html.push(`<table ${attrs}><tbody>`);
      for (const row of block.cells) {
        html.push('<tr>');
        for (const cell of row) {
          const tag = cell.header ? 'th' : 'td';
          html.push(`<${tag} rowspan="${cell.rowSpan}" colspan="${cell.colSpan}">${cell.paragraphs.map(p => `<p>${renderRuns(p)}</p>`).join('')}</${tag}>`);
        }
        html.push('</tr>');
      }
      html.push('</tbody></table>');
    } else {
      const tag = block.kind === 'heading' ? `h${Math.min(6, Math.max(2, block.level || 2))}` : 'p';
      html.push(`<${tag} ${attrs}>${renderRuns(block.runs)}</${tag}>`);
    }
  }
  closeList();
  return { fileName: source.fileName, summary: '', notes: blocks.map(b => b.text), questions: [], noteBlocks, source,
    coverage: { represented: blocks.length, intentionallyOmitted: source.blocks.length - blocks.length, unresolved: source.unresolved.length,
      status: source.unresolved.length ? 'needs_review' : 'extracted_text_complete' },
    generatedBy: 'source-preserved', sourceHtml: html.join(''),
    notice: 'Organized directly from your uploaded document. No outside information was added.' };
}
