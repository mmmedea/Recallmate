import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { requireUser, checkRateLimit } from "@/lib/security";

export const runtime = "nodejs";
export const preferredRegion = "iad1";

const ASSEMBLYAI_KEY = process.env.ASSEMBLYAI_API_KEY;
const MAX_MEDIA_BYTES = 20 * 1024 * 1024;
const redisUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const redisToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";
const redis = redisUrl && redisToken ? new (require("@upstash/redis").Redis)({ url: redisUrl, token: redisToken }) : null;

function isYouTubeUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2048) return false;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:") return false;
    if (!["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "www.youtu.be"].includes(parsed.hostname)) return false;
    return Boolean(parsed.hostname === "youtu.be" ? parsed.pathname.slice(1).match(/^[\w-]{11}$/) : (parsed.searchParams.get("v") || parsed.pathname.match(/^\/(?:embed|shorts|v)\/([\w-]{11})$/)?.[1])?.match(/^[\w-]{11}$/));
  } catch { return false; }
}

function videoIdFromUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.hostname.includes("youtu.be")
      ? url.pathname.slice(1)
      : url.searchParams.get("v") || url.pathname.match(/^\/(?:embed|shorts|v)\/([\w-]{11})$/)?.[1] || null;
  } catch { return null; }
}

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireUser();
    await checkRateLimit(user.id);

    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = await req.json().catch(() => null);
      if (!body || !isYouTubeUrl(body.url)) {
        return NextResponse.json({ error: "A valid HTTPS YouTube URL is required." }, { status: 400 });
      }

      const videoId = videoIdFromUrl(body.url)!;
      const promptText = `Analyze and provide a detailed academic transcript summary and study guide for this YouTube video/lecture URL: https://www.youtube.com/watch?v=${videoId}. Include key concepts, core definitions, and main takeaways.`;

      if (redis) {
        try {
          const cached = await redis.get(`yt-summary:${videoId}`);
          if (cached) return NextResponse.json({ transcript: cached, text: cached, videoId, cached: true });
        } catch (error) { console.warn("Redis cache read failed"); }
      }

      const { callGeminiRest, callGroqChat, withFallback } = await import("@/lib/ai-provider");
      const transcriptText = await withFallback(
        async () => {
          if (!(process.env.GEMINI_API_KEY_02 || process.env.GEMINI_API_KEY)) throw new Error("Gemini key not configured.");
          return callGeminiRest(promptText, { temperature: 0.5, maxOutputTokens: 2000 });
        },
        async () => {
          if (!process.env.GROQ_API_KEY) throw new Error("Groq key not configured.");
          return callGroqChat("You are an expert academic content summarizer. Provide clear study guides from YouTube video URLs.", promptText, { temperature: 0.5, maxTokens: 2000, jsonMode: false });
        },
        "YouTube Transcribe"
      );

      if (redis) {
        try { await redis.set(`yt-summary:${videoId}`, transcriptText, { ex: 604800 }); }
        catch (error) { console.warn("Redis cache write failed"); }
      }
      return NextResponse.json({ transcript: transcriptText, text: transcriptText, videoId });
    }

    if (!contentType.toLowerCase().includes("multipart/form-data")) {
      return NextResponse.json({ error: "Expected multipart form data or JSON." }, { status: 415 });
    }
    if (!ASSEMBLYAI_KEY) return NextResponse.json({ error: "Transcription is not configured." }, { status: 503 });

    const formData = await req.formData();
    const entry = formData.get("file");
    if (!(entry instanceof File) || entry.size <= 0) return NextResponse.json({ error: "No valid file provided." }, { status: 400 });
    if (entry.size > MAX_MEDIA_BYTES) return NextResponse.json({ error: "Media file exceeds the 20MB limit." }, { status: 413 });

    const buffer = Buffer.from(await entry.arrayBuffer());
    if (!buffer.length || buffer.length !== entry.size) return NextResponse.json({ error: "Invalid media upload." }, { status: 400 });

    const uploadRes = await fetch("https://api.assemblyai.com/v2/upload", {
      method: "POST",
      headers: { authorization: ASSEMBLYAI_KEY },
      body: buffer,
      signal: AbortSignal.timeout(60_000),
    });
    if (!uploadRes.ok) return NextResponse.json({ error: "Media upload provider rejected the file." }, { status: 502 });
    const uploadData = await uploadRes.json();
    if (typeof uploadData.upload_url !== "string") return NextResponse.json({ error: "Media upload failed." }, { status: 502 });

    const transcriptRes = await fetch("https://api.assemblyai.com/v2/transcript", {
      method: "POST",
      headers: { authorization: ASSEMBLYAI_KEY, "content-type": "application/json" },
      body: JSON.stringify({ audio_url: uploadData.upload_url }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!transcriptRes.ok) return NextResponse.json({ error: "Transcription request failed." }, { status: 502 });
    const transcriptData = await transcriptRes.json();
    if (typeof transcriptData.id !== "string") return NextResponse.json({ error: "Transcription request failed." }, { status: 502 });

    const deadline = Date.now() + 5 * 60_000;
    let transcript: any = transcriptData;
    while (transcript.status !== "completed" && transcript.status !== "error" && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 3000));
      const pollRes = await fetch(`https://api.assemblyai.com/v2/transcript/${encodeURIComponent(transcriptData.id)}`, {
        headers: { authorization: ASSEMBLYAI_KEY },
        signal: AbortSignal.timeout(15_000),
      });
      if (!pollRes.ok) return NextResponse.json({ error: "Transcription status check failed." }, { status: 502 });
      transcript = await pollRes.json();
    }
    if (transcript.status !== "completed") {
      return NextResponse.json({ error: transcript.status === "error" ? "Transcription provider could not process this file." : "Transcription timed out. Please try again." }, { status: 502 });
    }
    return NextResponse.json({ text: transcript.text, transcript: transcript.text });
  } catch (error: any) {
    const status = error?.status && Number.isInteger(error.status) ? error.status : error?.message === "Rate limit exceeded" ? 429 : 500;
    if (status >= 500) console.error("Transcription failed:", error);
    return NextResponse.json({ error: status === 429 ? "Rate limit exceeded. Please try again later." : status === 401 ? "Unauthorized" : "Transcription failed." }, { status });
  }
}
