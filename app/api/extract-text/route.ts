import { NextRequest, NextResponse } from "next/server";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const name = file.name.toLowerCase();
    let text = "";

    if (name.endsWith(".pdf")) {
      const result = await pdfParse(buffer);
      text = result.text;
    } else if (name.endsWith(".docx")) {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else if (name.endsWith(".txt") || name.endsWith(".md")) {
      text = buffer.toString("utf-8");
    } else {
      return NextResponse.json(
        { error: "Unsupported file type for direct text extraction." },
        { status: 400 }
      );
    }

    return NextResponse.json({ text });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to extract text." }, { status: 500 });
  }
}