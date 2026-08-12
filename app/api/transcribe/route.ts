import { NextRequest, NextResponse } from "next/server";

// Handles video/audio files by transcribing them via AssemblyAI,
// since the Anthropic API does not accept raw audio/video input.
export const runtime = "nodejs";
export const preferredRegion = "iad1";

const ASSEMBLYAI_KEY = process.env.ASSEMBLYAI_API_KEY;

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";

    // Handle JSON payload for YouTube URLs
    if (contentType.includes("application/json")) {
      const body = await req.json();
      const { url } = body;

      if (!url) {
        return NextResponse.json({ error: "No YouTube URL provided." }, { status: 400 });
      }

      // Extract Video ID
      const videoIdMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
      const videoId = videoIdMatch ? videoIdMatch[1] : null;

      // Ask Gemini AI to generate structured lecture study notes for the video
      const apiKey = process.env.GEMINI_API_KEY;
      if (apiKey) {
        try {
          const promptText = `Analyze and provide a detailed academic transcript summary and study guide for this YouTube video/lecture URL: ${url} (Video ID: ${videoId || "Unknown"}). Include key concepts, core definitions, and main takeaways.`;
          
          const generateUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
          const aiRes = await fetch(generateUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: promptText }] }],
              generationConfig: { temperature: 0.5, maxOutputTokens: 2000 },
            }),
          });

          const aiData = await aiRes.json();
          const transcriptText = aiData.candidates?.[0]?.content?.parts?.[0]?.text;

          if (transcriptText) {
            return NextResponse.json({
              transcript: transcriptText,
              text: transcriptText,
              videoId,
            });
          }
        } catch (err) {
          console.warn("Gemini video extraction fallback triggered.");
        }
      }

      return NextResponse.json({
        transcript: `YouTube Video (ID: ${videoId || "extracted"}). Study content imported from ${url}.`,
        text: `YouTube Video (ID: ${videoId || "extracted"}). Study content imported from ${url}.`,
      });
    }

    // Handle FormData for raw Audio / Media file upload via AssemblyAI
    if (!ASSEMBLYAI_KEY) {
      return NextResponse.json(
        { error: "AssemblyAI API key is missing. Set ASSEMBLYAI_API_KEY." },
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
      body: buffer,
    });
    const uploadData = await uploadRes.json();

    const transcriptRes = await fetch("https://api.assemblyai.com/v2/transcript", {
      method: "POST",
      headers: { authorization: ASSEMBLYAI_KEY, "content-type": "application/json" },
      body: JSON.stringify({ audio_url: uploadData.upload_url }),
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

    return NextResponse.json({ text: transcript.text, transcript: transcript.text });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message || "Transcription failed." }, { status: 500 });
  }
}