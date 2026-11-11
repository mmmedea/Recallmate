import mammoth from 'mammoth';
import JSZip from 'jszip';
import { isStudyInstruction, type AcademicSource, type SourceBlock, type SourceRun, type SourceCell } from './academic-source';

// Mammoth's document transform exposes structure before its HTML conversion.
// Never render its unsanitized HTML or resolve document hyperlinks/external files.
type Node = { type: string; value?: string; children?: Node[]; styleName?: string; styleId?: string;
  isBold?: boolean; isItalic?: boolean; numbering?: { isOrdered: boolean; level: string }; colSpan?: number; rowSpan?: number; isHeader?: boolean };
function runsOf(node: Node, format: Omit<SourceRun, 'text'> = {}): SourceRun[] {
  if (node.type === 'text') return [{ text: node.value || '', ...format }];
  if (node.type === 'break' || node.type === 'tab') return [{ text: node.type === 'tab' ? '\t' : '\n', ...format }];
  const next = node.type === 'run' ? { bold: node.isBold, italic: node.isItalic } : format;
  return (node.children || []).flatMap(child => runsOf(child, next));
}
export async function extractDocxSource(data: ArrayBuffer | Uint8Array, fileName: string, documentId?: string): Promise<AcademicSource> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  if (bytes.byteLength > 50 * 1024 * 1024) throw new Error('Document exceeds 50 MB limit.');
  const zip = await JSZip.loadAsync(bytes);
  if (!zip.file('word/document.xml') || !zip.file('[Content_Types].xml')) throw new Error('Not a valid DOCX document.');
  const expanded = Object.values(zip.files).reduce((size, entry: any) => size + (entry._data?.uncompressedSize || 0), 0);
  if (expanded > 100 * 1024 * 1024 || Object.keys(zip.files).length > 5000) throw new Error('DOCX exceeds safe extraction limits.');
  const arrayBuffer = new Uint8Array(bytes).buffer;
  const digest = await globalThis.crypto.subtle.digest('SHA-256', arrayBuffer);
  const source_hash = Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, '0')).join('');
  const source: AcademicSource = { version: 1, document_id: documentId || `source:${source_hash}`, source_hash, fileName,
    document_type: /reviewer/i.test(fileName) ? 'reviewer' : 'lecture_notes', blocks: [], unresolved: [] };
  let excludedSection = false;
  let objectiveSection = false;
  let section: string[] = [];
  await mammoth.convertToHtml(typeof window === 'undefined' ? { buffer: Buffer.from(bytes) } : { arrayBuffer }, {
    externalFileAccess: false, includeEmbeddedStyleMap: false,
    convertImage: mammoth.images.imgElement(async () => ({ src: '' })),
    transformDocument: (document: Node) => {
      const walkUnsupported = (n: Node) => {
        if (['image','noteReference','commentReference'].includes(n.type)) source.unresolved.push(`${n.type}:${source.unresolved.length}`);
        (n.children || []).forEach(walkUnsupported);
      };
      walkUnsupported(document);
      for (const node of document.children || []) {
        const runs = runsOf(node);
        const text = runs.map(r => r.text).join('').trim();
        if (!text) continue;
        const style = node.styleName || node.styleId || '';
        const headingLevel = /heading\s*([1-6])/i.exec(style)?.[1];
        const heading = !!headingLevel || (node.type === 'paragraph' && text.length < 100 && /^[A-Z][A-Z /&-]+$/.test(text));
        const level = headingLevel ? Number(headingLevel) : 2;
        if (heading) {
          excludedSection = /^(?:purpose of (?:this|the) reviewer|how to use|study tips|study instructions)\b/i.test(text);
          objectiveSection = /^(?:examination coverage|learning objectives?|study objectives?|concepts to master)\b/i.test(text);
          section = [...section.slice(0, level - 1), text];
        }
        const block: SourceBlock = { id: `docx-${source.blocks.length}`, order: source.blocks.length, text, runs, section: [...section],
          kind: heading ? 'heading' : node.numbering ? 'list_item' : node.type === 'table' ? 'table' : 'paragraph',
          level: heading ? level : node.numbering ? Number(node.numbering.level) : undefined, ordered: node.numbering?.isOrdered,
          classification: /^(title|subtitle)$/i.test(style) ? 'title' : excludedSection ? 'reviewer_metadata' :
            objectiveSection ? 'learning_objective' : isStudyInstruction(text) ? 'study_instruction' : node.type === 'table' ? 'table' :
            /\b(is|means|refers to)\b/.test(text) && !heading ? 'definition' : 'academic_content' };
        if (node.type === 'table') {
          const occupied: number[] = [];
          block.cells = (node.children || []).map((row, rowIndex) => {
            let column = 0;
            return (row.children || []).map(cell => {
              while ((occupied[column] || 0) > rowIndex) column++;
              const value: SourceCell = { row: rowIndex, column, rowSpan: cell.rowSpan || 1, colSpan: cell.colSpan || 1, header: !!row.isHeader,
                paragraphs: (cell.children || []).map(p => runsOf(p)) };
              for (let c = column; c < column + value.colSpan; c++) occupied[c] = rowIndex + value.rowSpan;
              column += value.colSpan;
              return value;
            });
          });
          block.text = block.cells.map(row => row.map(c => c.paragraphs.map(p => p.map(r => r.text).join('')).join('\n')).join(' | ')).join('\n');
          if (/useful sentence starter/i.test(block.text)) block.classification = 'study_instruction';
        }
        source.blocks.push(block);
      }
      return document;
    },
  } as any);
  if (!source.blocks.length) throw new Error('DOCX contains no readable study content.');
  return source;
}
