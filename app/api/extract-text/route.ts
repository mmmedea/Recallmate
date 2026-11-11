import { NextRequest, NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import officeParser from "officeparser";
import { requireUser, checkRateLimit } from "@/lib/security";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 4.5 * 1024 * 1024;
const MAGIC_BYTES = {
  pdf: [0x25, 0x50, 0x44, 0x46],
  png: [0x89, 0x50, 0x4e, 0x47],
  jpeg: [0xff, 0xd8, 0xff],
  zip: [0x50, 0x4b, 0x03, 0x04],
  ole: [0xd0, 0xcf, 0x11, 0xe0],
} as const;

function matchesMagic(buffer: Uint8Array, signature: readonly number[]) {
  return buffer.length >= signature.length && signature.every((byte, index) => buffer[index] === byte);
}

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireUser();
    await checkRateLimit(user.id);

    const contentType = req.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("multipart/form-data")) {
      return NextResponse.json({ error: "Expected multipart form data." }, { status: 415 });
    }

    const formData = await req.formData();
    const entry = formData.get("file");
    if (!(entry instanceof File) || entry.size <= 0) {
      return NextResponse.json({ error: "No valid file provided." }, { status: 400 });
    }
    if (entry.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File size exceeds the 4.5MB server limit." }, { status: 413 });
    }

    const fileName = entry.name.toLowerCase();
    const extension = fileName.split(".").pop() || "";
    const allowed = new Set(["pdf", "png", "jpg", "jpeg", "docx", "doc", "pptx", "ppt", "txt", "md", "csv"]);
    if (!allowed.has(extension)) {
      return NextResponse.json({ error: "Unsupported file type." }, { status: 415 });
    }

    const arrayBuffer = await entry.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (buffer.length !== entry.size) {
      return NextResponse.json({ error: "Invalid uploaded file." }, { status: 400 });
    }

    const header = new Uint8Array(arrayBuffer.slice(0, 8));
    const signatureValid =
      (extension === "pdf" && matchesMagic(header, MAGIC_BYTES.pdf)) ||
      (extension === "png" && matchesMagic(header, MAGIC_BYTES.png)) ||
      ((extension === "jpg" || extension === "jpeg") && matchesMagic(header, MAGIC_BYTES.jpeg)) ||
      ((extension === "docx" || extension === "pptx") && matchesMagic(header, MAGIC_BYTES.zip)) ||
      ((extension === "doc" || extension === "ppt") && matchesMagic(header, MAGIC_BYTES.ole));

    if (["pdf", "png", "jpg", "jpeg", "docx", "doc", "pptx", "ppt"].includes(extension) && !signatureValid) {
      return NextResponse.json({ error: "File signature does not match the declared document type." }, { status: 400 });
    }

    let extractedText = "";
    if (extension === "pdf") {
      const parser = new PDFParse({ data: buffer });
      try { extractedText = (await parser.getText()).text; }
      finally { await parser.destroy(); }
    } else if (extension === "docx" || extension === "doc") {
      extractedText = (await mammoth.extractRawText({ buffer })).value;
    } else if (extension === "pptx" || extension === "ppt") {
      const ast = await officeParser.parseOffice(buffer) as any;
      const textOutput = await ast.to("text");
      extractedText = textOutput.value || textOutput;
    } else if (extension === "txt" || extension === "md" || extension === "csv") {
      extractedText = buffer.toString("utf-8");
    } else if (extension === "png" || extension === "jpg" || extension === "jpeg") {
      const mimeType = extension === "png" ? "image/png" : "image/jpeg";
      extractedText = JSON.stringify({ inlineData: { data: buffer.toString("base64"), mimeType } });
    }

    if (!extractedText || extractedText.trim().length < 3) {
      return NextResponse.json({ error: "The uploaded file contains no readable text or is empty." }, { status: 400 });
    }
    return NextResponse.json({ text: extractedText });
  } catch (error: any) {
    const status = Number.isInteger(error?.status) ? error.status : error?.message === "Rate limit exceeded" ? 429 : 500;
    if (status >= 500) console.error("Secure text extraction failed:", error);
    return NextResponse.json({ error: status === 401 ? "Unauthorized" : status === 429 ? "Rate limit exceeded. Please try again later." : status === 503 ? "Extraction service is temporarily unavailable." : "An error occurred while processing the file." }, { status });
  }
}
