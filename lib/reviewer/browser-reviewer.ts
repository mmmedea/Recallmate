import JSZip from "jszip";
import { shouldExcludeReviewerSection } from "./source-filter";

export type ReviewerSection = {
  title: string;
  text: string;
  images: string[];
  tables?: string[][][];
};

export type ReviewerArtifacts = {
  pdf: Blob;
  docx: Blob;
  baseName: string;
  sectionCount: number;
};

export type ReviewerTheme = {
  name: string;
  accent: string;
  tint: string;
};

export const REVIEWER_THEMES: ReviewerTheme[] = [
  { name: "RecallMate Lavender", accent: "A78BFA", tint: "F1EAFF" },
  { name: "RecallMate Rose", accent: "F43F5E", tint: "FFE7EC" },
  { name: "Deep Violet", accent: "7C3AED", tint: "EDE9FE" },
  { name: "Slate", accent: "475569", tint: "E2E8F0" },
  { name: "Blue", accent: "2563EB", tint: "DBEAFE" },
];

const DEFAULT_REVIEWER_THEME = REVIEWER_THEMES[0];

function hexRgb(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  return [Number.parseInt(value.slice(0, 2), 16), Number.parseInt(value.slice(2, 4), 16), Number.parseInt(value.slice(4, 6), 16)];
}

async function toGrayscalePng(source: string) {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error("An embedded lesson image could not be rendered."));
    element.src = source;
  });
  const canvas = window.document.createElement("canvas");
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("This browser could not prepare the reviewer images.");
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let index = 0; index < pixels.data.length; index += 4) {
    const gray = Math.round(0.299 * pixels.data[index] + 0.587 * pixels.data[index + 1] + 0.114 * pixels.data[index + 2]);
    pixels.data[index] = gray;
    pixels.data[index + 1] = gray;
    pixels.data[index + 2] = gray;
  }
  context.putImageData(pixels, 0, 0);
  return canvas.toDataURL("image/png");
}

function decodeXmlText(value: string) {
  const node = new DOMParser().parseFromString(`<x>${value}</x>`, "text/xml");
  return node.documentElement.textContent?.trim() ?? "";
}

function decodeXmlRun(value: string) {
  const node = new DOMParser().parseFromString(`<x>${value}</x>`, "text/xml");
  return node.documentElement.textContent ?? "";
}

function cleanReviewerLine(value: string) {
  const line = value.replace(/\s+/g, " ").trim();
  if (!line || /^loading\.{0,3}$/i.test(line) || /^click to add (?:title|text)$/i.test(line)) return "";
  if (/^[•·.\-–—,;:]+$/.test(line)) return "";
  return line;
}

function extractPptParagraphs(xml: string) {
  const lines: string[] = [];
  for (const paragraph of xml.matchAll(/<a:p(?:\s[^>]*)?>([\s\S]*?)<\/a:p>/g)) {
    const runs = [...paragraph[1].matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g)]
      .map(match => decodeXmlRun(match[1]));
    const content = cleanReviewerLine(runs.join(""));
    if (!content) continue;
    const bullet = /<a:bu(?:Char|AutoNum)\b/i.test(paragraph[1]);
    lines.push(bullet ? `• ${content.replace(/^[-•]\s*/, "")}` : content);
  }
  if (!lines.length) {
    return [...xml.matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g)]
      .map(match => cleanReviewerLine(decodeXmlText(match[1])))
      .filter(Boolean);
  }
  return lines.filter((line, index) => index === 0 || line.toLowerCase() !== lines[index - 1].toLowerCase());
}

function normalizeZipPath(path: string) {
  const parts: string[] = [];
  for (const segment of path.replace(/\\/g, "/").split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") parts.pop(); else parts.push(segment);
  }
  return parts.join("/");
}

function mimeFromPath(path: string) {
  if (/\.png$/i.test(path)) return "image/png";
  if (/\.jpe?g$/i.test(path)) return "image/jpeg";
  if (/\.gif$/i.test(path)) return "image/gif";
  if (/\.webp$/i.test(path)) return "image/webp";
  return null;
}

export async function extractPptxReviewerSections(buffer: ArrayBuffer): Promise<ReviewerSection[]> {
  const zip = await JSZip.loadAsync(buffer);
  const slidePaths = Object.keys(zip.files)
    .filter(path => /^ppt\/slides\/slide\d+\.xml$/i.test(path))
    .sort((a, b) => Number(a.match(/slide(\d+)/i)?.[1]) - Number(b.match(/slide(\d+)/i)?.[1]));

  const sections: ReviewerSection[] = [];
  for (const slidePath of slidePaths) {
    const xml = await zip.file(slidePath)?.async("string");
    if (!xml) continue;
    const tables = [...xml.matchAll(/<a:tbl\b[\s\S]*?<\/a:tbl>/g)].map(tableMatch =>
      [...tableMatch[0].matchAll(/<a:tr\b[\s\S]*?<\/a:tr>/g)].map(rowMatch =>
        [...rowMatch[0].matchAll(/<a:tc\b[\s\S]*?<\/a:tc>/g)].map(cellMatch =>
          [...cellMatch[0].matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g)]
            .map(match => decodeXmlText(match[1]))
            .filter(Boolean)
            .join(" ")
        )
      ).filter(row => row.some(Boolean))
    ).filter(table => table.length > 0);
    const proseXml = xml.replace(/<a:tbl\b[\s\S]*?<\/a:tbl>/g, "");
    const paragraphLines = extractPptParagraphs(proseXml);
    const text = paragraphLines.join("\n");
    if (shouldExcludeReviewerSection(text)) continue;

    const slideNumber = slidePath.match(/slide(\d+)/i)?.[1] ?? "";
    const relPath = `ppt/slides/_rels/slide${slideNumber}.xml.rels`;
    const relXml = await zip.file(relPath)?.async("string");
    const rels = new Map<string, string>();
    for (const match of relXml?.matchAll(/<Relationship\b[^>]*\bId="([^"]+)"[^>]*\bTarget="([^"]+)"[^>]*\/?\s*>/g) ?? []) {
      rels.set(match[1], normalizeZipPath(`ppt/slides/${match[2]}`));
    }

    const imageIds = [...xml.matchAll(/<a:blip\b[^>]*(?:r:embed|r:link)="([^"]+)"[^>]*>/g)].map(match => match[1]);
    const images: string[] = [];
    for (const id of [...new Set(imageIds)]) {
      const imagePath = rels.get(id);
      const mime = imagePath ? mimeFromPath(imagePath) : null;
      const image = imagePath ? zip.file(imagePath) : null;
      if (!image || !mime) continue;
      images.push(`data:${mime};base64,${await image.async("base64")}`);
    }

    const lines = text.split(/\r?\n/).map(cleanReviewerLine).filter(Boolean);
    const lessonNumberTitle = /^lesson\s+\d+\s*:?$/i.test(lines[0] || "") && lines[1]
      ? `${lines[0].replace(/:$/, "")}: ${lines[1]}`
      : null;
    sections.push({
      title: lessonNumberTitle || lines[0] || `Slide ${slideNumber}`,
      text: lines.slice(lessonNumberTitle ? 2 : 1).join("\n") || lines[0] || "",
      images,
      tables,
    });
  }
  return sections;
}

async function extractLegacyPresentation(file: File): Promise<ReviewerSection[]> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch("/api/extract-text", { method: "POST", body: formData });
  const data = await response.json() as { text?: string; error?: string };
  if (!response.ok || !data.text) throw new Error(data.error || "The presentation could not be read.");
  const blocks = data.text.split(/(?:---\s*Slide\s*\d+\s*---|\f)/i).map(value => value.trim()).filter(Boolean);
  return blocks.filter(value => !shouldExcludeReviewerSection(value)).map((value, index) => {
    const lines = value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    return { title: lines[0] || `Section ${index + 1}`, text: lines.slice(1).join("\n"), images: [] };
  });
}

async function extractPdfPageImages(buffer: ArrayBuffer): Promise<ReviewerSection[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.js");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.js", import.meta.url).toString();
  const document = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
  const sections: ReviewerSection[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
    const page = await document.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const text = textContent.items.map((item: any) => item.str || "").join(" ").trim();
    if (shouldExcludeReviewerSection(text)) continue;
    const lines = textContent.items
      .map((item: any) => String(item.str || "").trim())
      .filter(Boolean);
    sections.push({
      title: lines[0] || `Page ${pageNumber}`,
      text: lines.slice(1).join("\n"),
      images: [],
    });
  }
  return sections;
}

export async function readReviewerFile(file: File): Promise<ReviewerSection[]> {
  const lower = file.name.toLowerCase();
  const buffer = await file.arrayBuffer();
  if (lower.endsWith(".pptx")) return extractPptxReviewerSections(buffer);
  if (lower.endsWith(".pdf")) return extractPdfPageImages(buffer);
  if (lower.endsWith(".ppt")) return extractLegacyPresentation(file);
  throw new Error("Choose a PDF, PPT, or PPTX lesson file.");
}

function reviewerBaseName(file: File) {
  return file.name.replace(/\.[^.]+$/, "").replace(/[^a-z0-9_-]+/gi, "-") || "RecallMate";
}

function isNoteLine(value: string) {
  return /^(?:note|mnemonic|memory aid|remember|important|exception|formula)\b/i.test(value.trim());
}

function examNoteLines(section: ReviewerSection) {
  return section.text.split(/\r?\n/).map(value => value.trim()).filter(value =>
    value && /(?:mnemonic|formula|exception|normal\s+(?:value|range)|\b\d+(?:\.\d+)?\s*(?:-|to|–)\s*\d|increas|decreas|must|never|always)/i.test(value)
  ).slice(0, 4);
}

function dataUrlToBytes(value: string) {
  const encoded = value.split(",")[1] || "";
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export async function buildReviewerPdfBlob(file: File, sections: ReviewerSection[], theme: ReviewerTheme = DEFAULT_REVIEWER_THEME) {
  if (!sections.length) throw new Error("No lesson sections remained after removing administrative slides.");
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "letter", orientation: "portrait", compress: true });
  const pageWidth = 215.9;
  const pageHeight = 279.4;
  const margin = 10.5;
  const gap = 6.5;
  const columnWidth = (pageWidth - margin * 2 - gap) / 2;
  const top = 18;
  const bottom = 13;
  let column = 0;
  let y = top;
  const accent = hexRgb(theme.accent);
  const tint = hexRgb(theme.tint);

  const decoratePage = () => {
    pdf.setDrawColor(...accent);
    pdf.setLineWidth(0.12);
    pdf.line(pageWidth / 2, top, pageWidth / 2, pageHeight - bottom + 1);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(6.8);
    pdf.setTextColor(0, 0, 0);
    pdf.text(`${file.name.replace(/\.[^.]+$/, "").toUpperCase()} - REVIEWER`, pageWidth / 2, 8.5, { align: "center", maxWidth: pageWidth - margin * 2 });
  };
  decoratePage();

  const x = () => margin + column * (columnWidth + gap);
  const advanceColumn = () => {
    if (column === 0) { column = 1; y = top; return; }
    pdf.addPage(); column = 0; y = top; decoratePage();
  };
  const ensure = (height: number) => { if (y + height > pageHeight - bottom) advanceColumn(); };

  for (const section of sections) {
    ensure(13);
    const titleLines = pdf.splitTextToSize(section.title.toUpperCase(), columnWidth - 4);
    const titleHeight = Math.max(7, titleLines.length * 4.1 + 2.5);
    ensure(titleHeight + 3);
    pdf.setFillColor(...accent);
    pdf.rect(x(), y - 4.2, columnWidth, titleHeight, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8.7);
    pdf.setTextColor(255, 255, 255);
    pdf.text(titleLines, x() + 2, y, { lineHeightFactor: 1.05 });
    y += titleHeight + 0.8;

    if (section.text.trim()) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7.5);
      pdf.setTextColor(0, 0, 0);
      const paragraphs = section.text.split(/\r?\n/).map(cleanReviewerLine).filter(Boolean);
      for (const paragraph of paragraphs) {
        const isBullet = paragraph.startsWith("• ");
        const printable = isBullet ? paragraph.slice(2) : paragraph;
        const availableWidth = columnWidth - (isBullet ? 5 : 0);
        const lines = pdf.splitTextToSize(printable, availableWidth);
        if (isNoteLine(paragraph)) {
          const boxHeight = Math.max(10, lines.length * 3.15 + 6.5);
          ensure(boxHeight + 2);
          pdf.setFillColor(241, 234, 255);
          pdf.setDrawColor(167, 139, 250);
          pdf.rect(x(), y - 2.5, columnWidth, boxHeight, "FD");
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(7.2);
          pdf.text("NOTE", x() + 3, y + 1);
          pdf.setFont("helvetica", "normal");
          pdf.text(lines, x() + 3, y + 4.5, { maxWidth: columnWidth - 6, lineHeightFactor: 1.08 });
          y += boxHeight + 3;
          continue;
        }
        let offset = 0;
        while (offset < lines.length) {
          const room = Math.max(1, Math.floor((pageHeight - bottom - y) / 3.15));
          if (room <= 1) { advanceColumn(); continue; }
          const pageLines = lines.slice(offset, offset + room);
          if (isBullet && offset === 0) {
            pdf.circle(x() + 1.2, y - 1, 0.45, "F");
          }
          pdf.text(pageLines, x() + (isBullet ? 4 : 0), y, { lineHeightFactor: 1.08 });
          y += pageLines.length * 3.15 + 0.9;
          offset += pageLines.length;
          if (offset < lines.length) advanceColumn();
        }
      }
    }

    for (const table of section.tables || []) {
      y += 1;
      for (let rowIndex = 0; rowIndex < table.length; rowIndex++) {
        const row = table[rowIndex];
        const cellWidth = columnWidth / Math.max(1, row.length);
        const wrapped = row.map(cell => pdf.splitTextToSize(cleanReviewerLine(cell || ""), cellWidth - 3));
        const rowHeight = Math.max(6, ...wrapped.map(lines => lines.length * 2.65 + 3));
        ensure(rowHeight);
        row.forEach((_, cellIndex) => {
          // jsPDF uses the same non-stroking color state for text and fills. Reset
          // the cell fill before every rectangle so a previous cell's black text
          // cannot turn the following cell black.
          if (rowIndex === 0) pdf.setFillColor(...accent);
          else if (rowIndex % 2 === 0) pdf.setFillColor(...tint);
          else pdf.setFillColor(255, 255, 255);
          pdf.setDrawColor(135, 135, 135);
          pdf.rect(x() + cellIndex * cellWidth, y, cellWidth, rowHeight, "FD");
          pdf.setFont("helvetica", rowIndex === 0 ? "bold" : "normal");
          pdf.setFontSize(6.2);
          pdf.setTextColor(rowIndex === 0 ? 255 : 0, rowIndex === 0 ? 255 : 0, rowIndex === 0 ? 255 : 0);
          pdf.text(wrapped[cellIndex], x() + cellIndex * cellWidth + 1.5, y + 3.2, { maxWidth: cellWidth - 3, lineHeightFactor: 1.05 });
        });
        y += rowHeight;
      }
      pdf.setTextColor(0, 0, 0);
      y += 3;
    }

    const noteLines = examNoteLines(section);
    if (noteLines.length) {
      const noteText = noteLines.map(value => `- ${value}`);
      const wrapped = noteText.flatMap(value => pdf.splitTextToSize(value, columnWidth - 7));
      const height = wrapped.length * 3 + 8;
      ensure(height + 2);
      pdf.setFillColor(255, 246, 204);
      pdf.setDrawColor(211, 151, 31);
      pdf.rect(x(), y, columnWidth, height, "FD");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(6.8);
      pdf.text("NOTE - EXAM DETAILS", x() + 3, y + 5);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(6.3);
      pdf.text(wrapped, x() + 3, y + 8, { lineHeightFactor: 1.06 });
      y += height + 3;
    }

    for (const image of section.images) {
      const grayscaleImage = await toGrayscalePng(image);
      const properties = pdf.getImageProperties(grayscaleImage);
      const height = Math.min(82, columnWidth * properties.height / properties.width);
      ensure(height + 4);
      pdf.addImage(grayscaleImage, "PNG", x(), y, columnWidth, height, undefined, "FAST");
      y += height + 4;
    }
    y += 1.5;
  }

  const pageCount = pdf.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    pdf.setPage(page);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(6.5);
    pdf.setTextColor(0, 0, 0);
    pdf.text(`Page ${page} of ${pageCount}`, pageWidth / 2, pageHeight - 6, { align: "center" });
  }
  return pdf.output("blob");
}

export async function buildReviewerDocxBlob(file: File, sections: ReviewerSection[], theme: ReviewerTheme = DEFAULT_REVIEWER_THEME) {
  if (!sections.length) throw new Error("No lesson sections remained after removing administrative slides.");
  const {
    AlignmentType, BorderStyle, Document, Footer, Header, ImageRun, Packer, PageNumber,
    Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType,
  } = await import("docx");
  const subject = file.name.replace(/\.[^.]+$/, "").toUpperCase();
  const children: any[] = [];

  for (const section of sections) {
    children.push(new Paragraph({
      heading: "Heading1",
      keepNext: true,
      shading: { fill: theme.accent, type: ShadingType.CLEAR },
      spacing: { before: 120, after: 70 },
      indent: { left: 80, right: 80 },
      children: [new TextRun({ text: section.title.toUpperCase(), bold: true, color: "FFFFFF", size: 19, font: "Arial" })],
    }));
    for (const line of section.text.split(/\r?\n/).map(cleanReviewerLine).filter(Boolean)) {
      if (isNoteLine(line)) {
        children.push(new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [new TableRow({ children: [new TableCell({
            shading: { fill: "F1EAFF", type: ShadingType.CLEAR },
            margins: { top: 100, bottom: 100, left: 120, right: 120 },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 6, color: "A78BFA" },
              bottom: { style: BorderStyle.SINGLE, size: 6, color: "D3971F" },
              left: { style: BorderStyle.SINGLE, size: 6, color: "D3971F" },
              right: { style: BorderStyle.SINGLE, size: 6, color: "D3971F" },
            },
            children: [new Paragraph({ children: [
              new TextRun({ text: "NOTE  ", bold: true, size: 17, font: "Arial" }),
              new TextRun({ text: line, size: 17, font: "Arial" }),
            ] })],
          })] })],
        }));
      } else {
        const bullet = line.startsWith("• ");
        children.push(new Paragraph({
          ...(bullet ? { bullet: { level: 0 } } : {}),
          spacing: { after: 45, line: 220 },
          children: [new TextRun({ text: bullet ? line.slice(2) : line, size: 16, color: "000000", font: "Arial" })],
        }));
      }
    }
    for (const table of section.tables || []) {
      const maxColumns = Math.max(1, ...table.map(row => row.length));
      children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: table.map((row, rowIndex) => new TableRow({
          tableHeader: rowIndex === 0,
          children: Array.from({ length: maxColumns }, (_, columnIndex) => new TableCell({
            width: { size: Math.floor(100 / maxColumns), type: WidthType.PERCENTAGE },
            shading: rowIndex === 0
              ? { fill: theme.accent, type: ShadingType.CLEAR }
              : rowIndex % 2 === 0
                ? { fill: theme.tint, type: ShadingType.CLEAR }
                : undefined,
            margins: { top: 70, bottom: 70, left: 80, right: 80 },
            children: [new Paragraph({ children: [new TextRun({ text: cleanReviewerLine(row[columnIndex] || ""), bold: rowIndex === 0, color: rowIndex === 0 ? "FFFFFF" : "000000", size: 14, font: "Arial" })] })],
          })),
        })),
      }));
    }
    const noteLines = examNoteLines(section);
    if (noteLines.length) {
      children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [new TableRow({ children: [new TableCell({
          shading: { fill: "FFF6CC", type: ShadingType.CLEAR },
          margins: { top: 100, bottom: 100, left: 120, right: 120 },
          children: [new Paragraph({ children: [new TextRun({ text: "NOTE - EXAM DETAILS", bold: true, size: 16, font: "Arial" })] }), ...noteLines.map(value => new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: value, size: 16, font: "Arial" })] }))],
        })] })],
      }));
    }
    for (const source of section.images) {
      const grayscale = await toGrayscalePng(source);
      children.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        keepNext: true,
        spacing: { before: 80, after: 100 },
        children: [new ImageRun({
          type: "png",
          data: dataUrlToBytes(grayscale),
          transformation: { width: 270, height: 170 },
          altText: { title: section.title, description: `Source figure from ${section.title}`, name: section.title },
        })],
      }));
    }
  }

  const document = new Document({
    creator: "RecallMate",
    title: `${subject} - Reviewer`,
    description: "Detailed two-column academic reviewer generated from the uploaded source.",
    styles: {
      default: { document: { run: { font: "Arial", size: 16, color: "000000" }, paragraph: { spacing: { after: 45, line: 220 } } } },
      paragraphStyles: [{ id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: "Arial", size: 19, bold: true, color: "FFFFFF" }, paragraph: { keepNext: true, spacing: { before: 120, after: 70 } } }],
    },
    sections: [{
      properties: {
        page: { size: { width: 12240, height: 15840 }, margin: { top: 700, right: 540, bottom: 650, left: 540 } },
        column: { count: 2, space: 360, equalWidth: true, separate: true },
      },
      headers: { default: new Header({ children: [new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: theme.accent, space: 1 } },
        children: [new TextRun({ text: `${subject} - REVIEWER`, bold: true, size: 18, font: "Arial" })],
      })] }) },
      footers: { default: new Footer({ children: [new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [new TextRun({ text: "Page ", size: 16 }), new TextRun({ children: [PageNumber.CURRENT], size: 16 }), new TextRun({ text: " of ", size: 16 }), new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16 })],
      })] }) },
      children,
    }],
  });
  return Packer.toBlob(document);
}

export async function createReviewerArtifacts(file: File, sections: ReviewerSection[], theme: ReviewerTheme = DEFAULT_REVIEWER_THEME): Promise<ReviewerArtifacts> {
  const [pdf, docx] = await Promise.all([
    buildReviewerPdfBlob(file, sections, theme),
    buildReviewerDocxBlob(file, sections, theme),
  ]);
  return { pdf, docx, baseName: reviewerBaseName(file), sectionCount: sections.length };
}

export function downloadReviewerArtifact(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadReviewerPdf(file: File, sections: ReviewerSection[]) {
  const blob = await buildReviewerPdfBlob(file, sections);
  downloadReviewerArtifact(blob, `${reviewerBaseName(file)}-reviewer.pdf`);
}
