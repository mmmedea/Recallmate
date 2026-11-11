import JSZip from "jszip";
import { shouldExcludeReviewerSection } from "./source-filter";

export type ReviewerSection = {
  title: string;
  text: string;
  images: string[];
};

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
    const text = [...xml.matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g)]
      .map(match => decodeXmlText(match[1]))
      .filter(Boolean)
      .join("\n");
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

    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    sections.push({
      title: lines[0] || `Slide ${slideNumber}`,
      text: lines.slice(1).join("\n") || lines[0] || "",
      images,
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
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = window.document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext("2d")!, viewport }).promise;
    sections.push({ title: `Page ${pageNumber}`, text: "", images: [canvas.toDataURL("image/jpeg", 0.92)] });
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

export async function downloadReviewerPdf(file: File, sections: ReviewerSection[]) {
  if (!sections.length) throw new Error("No lesson sections remained after removing administrative slides.");
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 12;
  const gap = 8;
  const columnWidth = (pageWidth - margin * 2 - gap) / 2;
  const top = 24;
  const bottom = 14;
  let column = 0;
  let y = top;

  const decoratePage = () => {
    pdf.setDrawColor(25, 25, 25);
    pdf.setLineWidth(0.25);
    pdf.line(pageWidth / 2, top - 2, pageWidth / 2, pageHeight - bottom);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.setTextColor(0, 0, 0);
    pdf.text(file.name.replace(/\.[^.]+$/, ""), margin, 9, { maxWidth: pageWidth - margin * 2 });
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.text("RecallMate detailed reviewer", margin, 14);
  };
  decoratePage();

  const x = () => margin + column * (columnWidth + gap);
  const advanceColumn = () => {
    if (column === 0) { column = 1; y = top; return; }
    pdf.addPage(); column = 0; y = top; decoratePage();
  };
  const ensure = (height: number) => { if (y + height > pageHeight - bottom) advanceColumn(); };

  for (const section of sections) {
    ensure(16);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.setTextColor(0, 0, 0);
    const titleLines = pdf.splitTextToSize(section.title, columnWidth);
    pdf.text(titleLines, x(), y);
    y += titleLines.length * 5 + 2;

    if (section.text.trim()) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8.5);
      const paragraphs = section.text.split(/\r?\n/).map(value => value.trim()).filter(Boolean);
      for (const paragraph of paragraphs) {
        const lines = pdf.splitTextToSize(paragraph, columnWidth);
        let offset = 0;
        while (offset < lines.length) {
          const room = Math.max(1, Math.floor((pageHeight - bottom - y) / 3.8));
          if (room <= 1) { advanceColumn(); continue; }
          const pageLines = lines.slice(offset, offset + room);
          pdf.text(pageLines, x(), y, { lineHeightFactor: 1.15 });
          y += pageLines.length * 3.8 + 2;
          offset += pageLines.length;
          if (offset < lines.length) advanceColumn();
        }
      }
    }

    for (const image of section.images) {
      const grayscaleImage = await toGrayscalePng(image);
      const properties = pdf.getImageProperties(grayscaleImage);
      const height = Math.min(105, columnWidth * properties.height / properties.width);
      ensure(height + 4);
      pdf.addImage(grayscaleImage, "PNG", x(), y, columnWidth, height, undefined, "FAST");
      y += height + 4;
    }
    y += 4;
  }

  const safeName = file.name.replace(/\.[^.]+$/, "").replace(/[^a-z0-9_-]+/gi, "-");
  pdf.save(`${safeName || "RecallMate"}-reviewer.pdf`);
}
