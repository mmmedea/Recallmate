import { extractDocxSource } from '@/lib/source/docx-source';
import { notesEligible } from '@/lib/source/academic-source';

export interface DocumentChunk {
  chunk_index: number;
  page_number?: number;
  section_title?: string;
  content: string;
  metadata?: any;
}

const MAX_CHUNK_SIZE = 1500; // Characters per chunk roughly

function chunkText(text: string, pageNumber?: number, startingIndex: number = 0): DocumentChunk[] {
  const chunks: DocumentChunk[] = [];
  let currentChunk = '';
  const paragraphs = text.split(/\n\s*\n/);
  
  let chunkIndex = startingIndex;

  for (const p of paragraphs) {
    if (currentChunk.length + p.length > MAX_CHUNK_SIZE && currentChunk.length > 0) {
      chunks.push({
        chunk_index: chunkIndex++,
        page_number: pageNumber,
        content: currentChunk.trim()
      });
      currentChunk = '';
    }
    currentChunk += p + '\n\n';
  }

  if (currentChunk.trim().length > 0) {
    chunks.push({
      chunk_index: chunkIndex++,
      page_number: pageNumber,
      content: currentChunk.trim()
    });
  }

  return chunks;
}

export const processPdfServerSide = async (buffer: Buffer): Promise<DocumentChunk[]> => {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.js');
  const document = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    disableWorker: true,
    isEvalSupported: false,
  } as any).promise;

  const chunks: DocumentChunk[] = [];
  let chunkIndex = 0;
  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      const page = await document.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const text = textContent.items
        .map((item: any) => typeof item.str === 'string' ? item.str : '')
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      chunks.push(...chunkText(text, pageNumber, chunkIndex));
      chunkIndex = chunks.length;
      page.cleanup();
    }
  } finally {
    await document.destroy();
  }

  return chunks;
};

export const processDocxServerSide = async (buffer: Buffer): Promise<DocumentChunk[]> => {
  const source = await extractDocxSource(buffer, 'Uploaded document.docx');
  return source.blocks.filter(notesEligible).map(block => ({
    chunk_index: block.order, section_title: block.section.join(' / '), content: block.text,
    metadata: { source_version: source.version, source_hash: source.source_hash, source_block_id: block.id,
      classification: block.classification, source_block: block },
  }));
};

export const processTextServerSide = async (buffer: Buffer): Promise<DocumentChunk[]> => {
  const text = buffer.toString('utf-8');
  return chunkText(text, undefined, 0);
};

export const processPptxServerSide = async (buffer: Buffer): Promise<DocumentChunk[]> => {
  const JSZip = require('jszip');
  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(buffer);
  
  let resultText = "";
  
  for (const [relativePath, zipEntry] of Object.entries(loadedZip.files)) {
    if (relativePath.startsWith("ppt/slides/slide") && relativePath.endsWith(".xml")) {
      const xmlContent = await (zipEntry as any).async("string");
      const textMatches = xmlContent.match(/<a:t>([\s\S]*?)<\/a:t>/g);
      
      if (textMatches) {
        const slideText = textMatches.map((match: string) => match.replace(/<\/?a:t>/g, '')).join(" ");
        
        // Add slide number from filename as metadata
        const slideMatch = relativePath.match(/slide(\d+)\.xml/);
        const slideNumber = slideMatch ? parseInt(slideMatch[1]) : undefined;
        
        resultText += `\n--- Slide ${slideNumber || ''} ---\n` + slideText + "\n";
      }
    }
  }
  
  return chunkText(resultText, undefined, 0);
};

export const processFileServerSide = async (buffer: Buffer, mimeType: string, extension: string): Promise<DocumentChunk[]> => {
  const ext = extension.toLowerCase();
  
  if (ext === '.pdf' || mimeType === 'application/pdf') {
    return processPdfServerSide(buffer);
  } else if (ext === '.docx' || ext === '.doc' || mimeType.includes('wordprocessingml')) {
    return processDocxServerSide(buffer);
  } else if (ext === '.pptx' || mimeType.includes('presentationml')) {
    return processPptxServerSide(buffer);
  } else if (['.txt', '.md', '.csv'].includes(ext) || mimeType.includes('text')) {
    return processTextServerSide(buffer);
  } else {
    throw new Error(`Unsupported file type for extraction: ${extension}`);
  }
};

