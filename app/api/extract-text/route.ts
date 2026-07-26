import { NextRequest, NextResponse } from "next/server";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import officeParser from "officeparser";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let extractedText = "";
    const fileName = file.name.toLowerCase();

    // 1. Handle PDF files
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
    // 2. Handle Word documents (.docx, .doc)
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
    // 3. Handle PowerPoint presentations (.pptx, .ppt)
    else if (fileName.endsWith(".pptx") || fileName.endsWith(".ppt")) {
      try {
        extractedText = await officeParser.parseOfficeAsync(buffer);
      } catch (pptErr) {
        extractedText = `[Presentation File: ${file.name}]`;
      }
    }
    // 4. Handle Text, Markdown, and CSV files
    else if (
      fileName.endsWith(".txt") || 
      fileName.endsWith(".md") || 
      fileName.endsWith(".csv")
    ) {
      extractedText = buffer.toString("utf-8");
    }
    // 5. Handle Images (.png, .jpg, .jpeg) for Gemini Vision
    else if (
      fileName.endsWith(".png") || 
      fileName.endsWith(".jpg") || 
      fileName.endsWith(".jpeg")
    ) {
      // Correct way to format base64 for Gemini Vision
      const base64Data = buffer.toString("base64"); 
      
      const prompt = {
        inlineData: {
          data: base64Data, // Do NOT append "data:image/jpeg;base64,"
          mimeType: file.type
        }
      };

      // We stringify the object so it safely passes through the text extraction pipeline.
      // Make sure your /api/generate-content route uses JSON.parse() if it detects this structure!
      extractedText = JSON.stringify(prompt);
    } 
    else {
      extractedText = buffer.toString("utf-8");
    }

    // Validate extracted content
    if (!extractedText || extractedText.trim().length < 3) {
      return NextResponse.json(
        { error: "The uploaded file contains no readable text or is empty." },
        { status: 400 }
      );
    }

    return NextResponse.json({ text: extractedText });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to extract text from file." },
      { status: 500 }
    );
  }
}