import { NextRequest, NextResponse } from "next/server";

// Handles video/audio files by transcribing them via AssemblyAI,
// since the Anthropic API does not accept raw audio/video input.
export const runtime = "nodejs";

const ASSEMBLYAI_KEY = process.env.ASSEMBLYAI_API_KEY;

export async function POST(req: NextRequest) {
  try {
    if (!ASSEMBLYAI_KEY) {
      return NextResponse.json(
        { error: "Transcription service is not configured. Set ASSEMBLYAI_API_KEY." },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const uploadRes = await fetch("https://api.assemblyai.com/v2/upload", {
      method: "POST",
      headers: { authorization: ASSEMBLYAI_KEY },
      body: buffer
    });
    const uploadData = await uploadRes.json();

    const transcriptRes = await fetch("https://api.assemblyai.com/v2/transcript", {
      method: "POST",
      headers: { authorization: ASSEMBLYAI_KEY, "content-type": "application/json" },
      body: JSON.stringify({ audio_url: uploadData.upload_url })
    });
    const transcriptData = await transcriptRes.json();

    let transcript = transcriptData;
    while (transcript.status !== "completed" && transcript.status !== "error") {
      await new Promise((r) => setTimeout(r, 3000));
      const pollRes = await fetch(
        `https://api.assemblyai.com/v2/transcript/${transcriptData.id}`,
        { headers: { authorization: ASSEMBLYAI_KEY } }
      );
      transcript = await pollRes.json();
    }

    if (transcript.status === "error") {
      return NextResponse.json({ error: transcript.error }, { status: 500 });
    }

    return NextResponse.json({ text: transcript.text });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Transcription failed." }, { status: 500 });
  }
}