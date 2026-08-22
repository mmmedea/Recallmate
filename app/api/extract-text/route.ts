import { NextRequest, NextResponse } from "next/server";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import { processPptxServerSide } from "@/lib/server-parser";

export const runtime = "nodejs";

// Hard limit for Vercel Serverless payload size (4.5MB)
const MAX_FILE_SIZE = 4.5 * 1024 * 1024;

// Magic byte definitions for supported file types
const MAGIC_BYTES = {
  pdf: [0x25, 0x50, 0x44, 0x46], // %PDF
  png: [0x89, 0x50, 0x4E, 0x47], // PNG
  jpeg: [0xFF, 0xD8, 0xFF],      // JPEG
  zip: [0x50, 0x4B, 0x03, 0x04], // ZIP (Used by modern PPTX & DOCX)
  ole: [0xD0, 0xCF, 0x11, 0xE0], // Legacy OLE (Used by old .doc & .ppt)
};

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
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File size exceeds the 4.5MB server limit." },
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
        const parsedPdf = await pdfParse(buffer);
        extractedText = parsedPdf.text;
      } catch (pdfErr) {
        return NextResponse.json(
          { error: "Failed to parse PDF text. Ensure it is a valid, text-based PDF." },
          { status: 400 }
        );
      }
    } 
    // 4. Handle Word documents (.docx, .doc)
    else if (fileName.endsWith(".docx") || fileName.endsWith(".doc")) {
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
        const chunks = await processPptxServerSide(buffer);
        extractedText = chunks.map(c => c.content).join("\n\n");
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