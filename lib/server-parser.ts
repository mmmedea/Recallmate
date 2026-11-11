import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import officeParser from 'officeparser';

export interface DocumentChunk {
  chunk_index: number;
  page_number?: number;
  section_title?: string;
  content: string;
  metadata?: any;
}

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_ZIP_ENTRIES = 5000;
const MAX_ZIP_ENTRY_BYTES = 20 * 1024 * 1024;
const MAX_ZIP_EXPANDED_BYTES = 50 * 1024 * 1024;
const MAX_COMPRESSION_RATIO = 100;

function hasMagic(buffer: Buffer, bytes: number[]): boolean {
  return buffer.length >= bytes.length && bytes.every((byte, index) => buffer[index] === byte);
}

function chunkText(text: string, pageNumber?: number, startingIndex: number = 0): DocumentChunk[] {
  const chunks: DocumentChunk[] = [];
  let currentChunk = '';
  const paragraphs = text.split(/\n\s*\n/);
  let chunkIndex = startingIndex;

  for (const paragraph of paragraphs) {
    if (currentChunk.length + paragraph.length > 1500 && currentChunk.length > 0) {
      chunks.push({ chunk_index: chunkIndex++, page_number: pageNumber, content: currentChunk.trim() });
      currentChunk = '';
    }
    currentChunk += paragraph + '\n\n';
  }

  if (currentChunk.trim().length > 0) {
    chunks.push({ chunk_index: chunkIndex++, page_number: pageNumber, content: currentChunk.trim() });
  }
  return chunks;
}

async function loadSafeZipArchive(buffer: Buffer, requiredEntry: string) {
  if (!hasMagic(buffer, [0x50, 0x4b, 0x03, 0x04])) {
    throw new Error('Invalid Office document archive signature');
  }

  const JSZip = require('jszip');
  const zip = new JSZip();
  const archive = await zip.loadAsync(buffer, { checkCRC32: false, createFolders: false });
  const entries = Object.values(archive.files) as any[];

  if (entries.length > MAX_ZIP_ENTRIES) {
    throw new Error('Office document contains too many archive entries');
  }

  let expandedBytes = 0;
  for (const entry of entries) {
    if (entry.dir) continue;
    const entryName = String(entry.name || '').replace(/\\/g, '/');
    if (entryName.startsWith('/') || entryName.split('/').includes('..')) {
      throw new Error('Office document contains an unsafe archive path');
    }

    const uncompressedSize = Number(entry._data?.uncompressedSize ?? 0);
    const compressedSize = Number(entry._data?.compressedSize ?? 0);
    if (!Number.isFinite(uncompressedSize) || !Number.isFinite(compressedSize)
      || uncompressedSize < 0 || compressedSize < 0
      || uncompressedSize > MAX_ZIP_ENTRY_BYTES) {
      throw new Error('Office document contains an oversized archive entry');
    }

    expandedBytes += uncompressedSize;
    if (expandedBytes > MAX_ZIP_EXPANDED_BYTES) {
      throw new Error('Office document expands beyond the allowed size');
    }

    if (uncompressedSize > 1024 * 1024
      && uncompressedSize / Math.max(compressedSize, 1) > MAX_COMPRESSION_RATIO) {
      throw new Error('Office document compression ratio exceeds the allowed limit');
    }
  }

  if (!archive.file(requiredEntry)) {
    throw new Error('Office document is missing its required content');
  }
  return archive;
}

export const processPdfServerSide = async (buffer: Buffer): Promise<DocumentChunk[]> => {
  if (!hasMagic(buffer, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    throw new Error('Invalid PDF file signature');
  }

  const parser = new PDFParse({ data: buffer });
  let text = '';
  try {
    text = (await parser.getText()).text;
  } finally {
    await parser.destroy();
  }
  return chunkText(text);
};

export const processDocxServerSide = async (buffer: Buffer): Promise<DocumentChunk[]> => {
  await loadSafeZipArchive(buffer, 'word/document.xml');
  const result = await mammoth.extractRawText({ buffer });
  return chunkText(result.value);
};

export const processTextServerSide = async (buffer: Buffer): Promise<DocumentChunk[]> => {
  if (buffer.includes(0)) throw new Error('Binary data is not accepted as a text document');
  const text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  return chunkText(text);
};

export const processPptxServerSide = async (buffer: Buffer): Promise<DocumentChunk[]> => {
  const loadedZip = await loadSafeZipArchive(buffer, 'ppt/presentation.xml');
  let resultText = '';

  for (const [relativePath, zipEntry] of Object.entries(loadedZip.files)) {
    if (relativePath.startsWith('ppt/slides/slide') && relativePath.endsWith('.xml')) {
      const xmlContent = await (zipEntry as any).async('string');
      const textMatches = xmlContent.match(/<a:t>([\s\S]*?)<\/a:t>/g);

      if (textMatches) {
        const slideText = textMatches.map((match: string) => match.replace(/<\/?a:t>/g, '')).join(' ');
        const slideMatch = relativePath.match(/slide(\d+)\.xml/);
        const slideNumber = slideMatch ? parseInt(slideMatch[1], 10) : undefined;
        resultText += `\n--- Slide ${slideNumber || ''} ---\n` + slideText + '\n';
      }
    }
  }
  return chunkText(resultText);
};

export const processFileServerSide = async (buffer: Buffer, mimeType: string, extension: string): Promise<DocumentChunk[]> => {
  if (!Buffer.isBuffer(buffer) || buffer.length <= 0 || buffer.length > MAX_FILE_BYTES) {
    throw new Error('Document file size is outside the allowed range');
  }

  const ext = extension.toLowerCase();
  const mime = mimeType.toLowerCase();

  if (ext === '.pdf' && mime === 'application/pdf') {
    return processPdfServerSide(buffer);
  }
  if (ext === '.docx' && mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return processDocxServerSide(buffer);
  }
  if (ext === '.pptx' && mime === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
    return processPptxServerSide(buffer);
  }
  if ((ext === '.doc' && mime === 'application/msword')
    || (ext === '.ppt' && mime === 'application/vnd.ms-powerpoint')) {
    if (!hasMagic(buffer, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) {
      throw new Error('Invalid legacy Office document signature');
    }
    const parsed = await officeParser.parseOffice(buffer) as any;
    const output = await parsed.to('text');
    const text = typeof output === 'string' ? output : output?.value || '';
    return chunkText(text);
  }
  if (['.txt', '.md', '.csv'].includes(ext) && (mime.startsWith('text/') || (ext === '.csv' && mime === 'application/vnd.ms-excel'))) {
    return processTextServerSide(buffer);
  }

  throw new Error('File extension and MIME type are not supported together');
};
