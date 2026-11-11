import { NextRequest, NextResponse } from "next/server";
import mammoth from "mammoth";
import officeParser from "officeparser";
import { MAX_DOCUMENT_UPLOAD_BYTES, MAX_DOCUMENT_UPLOAD_MB } from "@/lib/constants";
import { extractDocxSource } from '@/lib/source/docx-source';
import { sourceAcademicText } from '@/lib/source/academic-source';

export const runtime = "nodejs";

// Magic byte definitions for supported file types
const MAGIC_BYTES = {
  pdf: [0x25, 0x50, 0x44, 0x46], // %PDF
  png: [0x89, 0x50, 0x4E, 0x47], // PNG
  jpeg: [0xFF, 0xD8, 0xFF],      // JPEG
  zip: [0x50, 0x4B, 0x03, 0x04], // ZIP (Used by modern PPTX & DOCX)
  ole: [0xD0, 0xCF, 0x11, 0xE0], // Legacy OLE (Used by old .doc & .ppt)
};

async function extractPdfText(buffer: Buffer) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.js");
  const document = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    disableWorker: true,
    isEvalSupported: false,
  } as any).promise;
  const pages: string[] = [];
  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      const page = await document.getPage(pageNumber);
      const textContent = await page.getTextContent();
      pages.push(textContent.items
        .map((item: any) => typeof item.str === "string" ? item.str : "")
        .join(" ")
        .replace(/\s+/g, " ")
        .trim());
      page.cleanup();
    }
  } finally {
    await document.destroy();
  }
  return pages.filter(Boolean).join("\n\n");
}

function verifyMagicBytes(buffer: Uint8Array, expected: number[]): boolean {
  if (buffer.length < expected.length) return false;
  return expected.every((byte, index) => buffer[index] === byte);
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }

    // 1. Enforce strict size check on the server
    if (file.size > MAX_DOCUMENT_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: `File exceeds ${MAX_DOCUMENT_UPLOAD_MB}MB limit.` },
        { status: 413 }
      );
    }

    const fileName = file.name.toLowerCase();
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // 2. Read first few bytes for signature inspection
    const headerBytes = new Uint8Array(arrayBuffer.slice(0, 8));

    // Only enforce Magic Byte checks on binary files (text/csv don't have magic signatures)
    const isBinaryType = fileName.match(/\.(pdf|png|jpg|jpeg|docx|doc|pptx|ppt)$/);
    
    if (isBinaryType) {
      const isPdf = verifyMagicBytes(headerBytes, MAGIC_BYTES.pdf);
      const isPng = verifyMagicBytes(headerBytes, MAGIC_BYTES.png);
      const isJpeg = verifyMagicBytes(headerBytes, MAGIC_BYTES.jpeg);
      const isZipDoc = verifyMagicBytes(headerBytes, MAGIC_BYTES.zip);
      const isLegacyDoc = verifyMagicBytes(headerBytes, MAGIC_BYTES.ole);

      if (!isPdf && !isPng && !isJpeg && !isZipDoc && !isLegacyDoc) {
        return NextResponse.json(
          { error: "Security Alert: File signature does not match allowed document types." },
          { status: 400 }
        );
      }
    }

    let extractedText = "";

    // 3. Handle PDF files
    if (fileName.endsWith(".pdf")) {
      try {
        extractedText = await extractPdfText(buffer);
      } catch (pdfErr) {
        return NextResponse.json(
          { error: "Failed to parse PDF text. Ensure it is a valid, text-based PDF." },
          { status: 400 }
        );
      }
    } 
    // 4. Handle Word documents (.docx, .doc)
    else if (fileName.endsWith(".docx")) {
      try {
        const source = await extractDocxSource(buffer, file.name);
        return NextResponse.json({ text: sourceAcademicText(source), source });
      } catch {
        return NextResponse.json({ error: 'The DOCX could not be extracted safely.' }, { status: 400 });
      }
    }
    else if (fileName.endsWith(".doc")) {
      try {
        const result = await mammoth.extractRawText({ buffer });
        extractedText = result.value;
      } catch (docErr) {
        return NextResponse.json(
          { error: "Failed to parse Word document text." },
          { status: 400 }
        );
      }
    }
    // 5. Handle PowerPoint presentations (.pptx, .ppt)
    else if (fileName.endsWith(".pptx") || fileName.endsWith(".ppt")) {
      try {
        const ast = await officeParser.parseOffice(buffer) as any;
        const textOutput = await ast.to('text');
        extractedText = textOutput.value || textOutput;
      } catch (pptErr) {
        extractedText = `[Presentation File: ${file.name}]`;
      }
    }
    // 6. Handle Text, Markdown, and CSV files
    else if (
      fileName.endsWith(".txt") || 
      fileName.endsWith(".md") || 
      fileName.endsWith(".csv")
    ) {
      extractedText = buffer.toString("utf-8");
    }
    // 7. Handle Images (.png, .jpg, .jpeg) for Gemini Vision
    else if (
      fileName.endsWith(".png") || 
      fileName.endsWith(".jpg") || 
      fileName.endsWith(".jpeg")
    ) {
      const base64Data = buffer.toString("base64"); 
      
      const prompt = {
        inlineData: {
          data: base64Data, 
          mimeType: file.type || (fileName.endsWith(".png") ? "image/png" : "image/jpeg")
        }
      };

      // Stringify the object so it safely passes through the text extraction pipeline.
      extractedText = JSON.stringify(prompt);
    } 
    else {
      extractedText = buffer.toString("utf-8");
    }

    // 8. Validate extracted content
    if (!extractedText || extractedText.trim().length < 3) {
      return NextResponse.json(
        { error: "The uploaded file contains no readable text or is empty." },
        { status: 400 }
      );
    }

    return NextResponse.json({ text: extractedText });

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "An error occurred while processing the file securely." },
      { status: 500 }
    );
  }
}
