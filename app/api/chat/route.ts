import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { callGroqChat, withFallback, GROQ_MODEL } from "@/lib/ai-provider";

export const runtime = "nodejs";
// Pin to US East where Gemini API is fully available (avoids EU geo-block)
export const preferredRegion = "iad1";

/**
 * Medea AI Tutor — Structured JSON Chat Route (v5 — Hybrid Free Tier)
 *
 * Changes in v5:
 *  1. Gemini 1.5 Flash remains the primary engine (free tier, strict JSON schema).
 *  2. Groq Llama 3.1 70B is the automatic fallback (free tier, JSON mode).
 *     If Gemini hits its 15 RPM rate limit or fails for any reason, Groq
 *     silently takes over — zero downtime for the student.
 *  3. Both paths preserve the Medea persona and internal_reasoning quarantine.
 */

// ── Gemini client ─────────────────────────────────────────────────────────────
const genAI = new GoogleGenerativeAI(
  process.env.GEMINI_API_KEY_02 || process.env.GEMINI_API_KEY || ""
);

// ── Bulletproof YouTube ID extractor ─────────────────────────────────────────
// Handles: full links, short links (youtu.be), /shorts/, /embed/,
//          and any trailing tracking params (?si=..., &feature=..., etc.)
function extractYouTubeId(url: string): string | null {
  const regExp =
    /^.*(?:youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[1].length === 11 ? match[1] : null;
}

// ── Shared JSON response schema (Gemini path) ─────────────────────────────────
const responseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    internal_reasoning: {
      type: SchemaType.STRING,
      description:
        "ALL step-by-step thinking, persona checks, math verification, LaTeX planning, and constraint validation. This key is NEVER sent to the student.",
    },
    clean_response: {
      type: SchemaType.STRING,
      description:
        "The final, beautifully polished, warm humanized tutoring response. Clean markdown and LaTeX ONLY ($...$ inline, $$...$$ block). Zero internal thought leaks.",
    },
  },
  required: ["internal_reasoning", "clean_response"],
};

// ── Medea system persona ──────────────────────────────────────────────────────
const MEDEA_PERSONA = `You are Medea, the brilliant, friendly, and highly encouraging AI Tutor & Smart Dictionary for RecallMate.
Your mission: make complicated academic subjects — physics, math, chemistry, history, geometry — incredibly easy to understand using vivid real-world analogies, clear worked examples, and warm encouragement.

You output STRICT JSON. Your thinking goes into internal_reasoning (never shown to students).
Your clean_response is the ONLY text the student sees — never output meta-tags, constraint labels, or planning headers.
Strip all conversational greetings, redundant "Hellos", and internal planning monologues from clean_response.

Rules for clean_response:
- Natural paragraphs and clean lists only. No stray #, *, _ symbols.
- All equations, formulas, and chemical reactions wrapped in LaTeX: $...$ (inline) or $$...$$ (block).
- CRITICAL JSON RULE: You MUST double-escape all LaTeX backslashes (e.g., use \\\\times instead of \\times, \\\\frac instead of \\frac).
- For definitions: provide clear meaning + a vivid real-world analogy.
- For calculations: show clearly numbered steps with LaTeX.
- When giving examples, ALWAYS start a new paragraph and use clean bullet points. Do not scramble examples together into a single paragraph.
- Use appropriate, clean symbols for lists and ensure the formatting is pristine and not messy.
- Follow elite Coherence, Cohesion, and Organizational patterns (combining Description, Chronological/Sequence, and Cause & Effect structures).
- Never echo "internal_reasoning" content, never say "Constraint 1:", never output "* User says...".
- **Strict Paragraph Structure**: When writing explanations, strictly follow standard academic paragraph structure. Every paragraph must have a single main idea consisting of a topic sentence, supporting details/evidence, and a concluding wrap-up sentence. Maintain pristine grammar at all times.
- **Strict Context Adherence**: If the student's message is unrelated to the uploaded document, answer their question directly. Do NOT force or invent a connection to the uploaded document.`;

// ── Groq system prompt (adapted for JSON mode without strict schema) ───────────
const GROQ_SYSTEM_PROMPT = `${MEDEA_PERSONA}

IMPORTANT: You MUST respond with ONLY a valid JSON object in this exact shape:
{
  "internal_reasoning": "<your private step-by-step thinking — never shown to students>",
  "clean_response": "<your final warm tutoring response with LaTeX where needed>"
}
No text outside the JSON object. No markdown code fences.`;

// ── Shared JSON parser used by both providers ─────────────────────────────────
function parseStructuredResponse(rawText: string): {
  cleanResponse: string;
} {
  try {
    // 1. LaTeX Normalization: Convert \( \) and \[ \] to $ and $$, and fix common unescaped math commands
    // LLMs often forget to double-escape \times in JSON, which JSON.parse turns into a tab + "imes"
    let normalizedText = rawText
      .replace(/(?<!\\)\\(times|text|theta|tan|tau|frac|nabla|neq|rightarrow|Rightarrow|rho|beta|begin)/g, "\\\\$1")
      .replace(/\\\(/g, "$")
      .replace(/\\\)/g, "$")
      .replace(/\\\[/g, "$$")
      .replace(/\\\]/g, "$$");

    // 2. JSON Truncation Patching
    let patchedText = normalizedText;
    if (!patchedText.trim().endsWith("}")) {
      const patches = ['"}', '"]}', ']}', '}'];
      for (const patch of patches) {
        try {
          JSON.parse(patchedText + patch);
          patchedText += patch;
          break;
        } catch (e) {}
      }
    }

    const parsed = JSON.parse(patchedText);
    // internal_reasoning is extracted and permanently DISCARDED server-side
    const cleanResponse = (parsed.clean_response || "").trim();
    return { cleanResponse };
  } catch {
    // Graceful fallback: treat raw text as the response
    return { cleanResponse: rawText.trim() };
  }
}

export async function POST(req: NextRequest) {
  try {
    const hasGemini = !!(process.env.GEMINI_API_KEY_02 || process.env.GEMINI_API_KEY);
    const hasGroq = !!process.env.GROQ_API_KEY;

    if (!hasGemini && !hasGroq) {
      return NextResponse.json(
        { error: "Server Configuration Error: No AI provider keys are configured." },
        { status: 500 }
      );
    }

    const {
      messages,
      documentContext,
      isFeynmanEvaluation = false,
    } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Invalid messages payload." }, { status: 400 });
    }

    const lastUserMessage: string = messages[messages.length - 1]?.content || "";

    // ── FEYNMAN EVALUATION (lightweight, non-JSON path) ───────────────────────
    if (isFeynmanEvaluation) {
      const feynmanPrompt = `You are Medea, evaluating a student's explanation using the Feynman Technique.
Rate clarity and semantic accuracy from 1 to 3 hearts. End with EXACT JSON: {"heartsEarned": 1|2|3}

Student explanation:
${lastUserMessage}`;

      const feynmanText = await withFallback(
        async () => {
          const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
          const result = await model.generateContent(feynmanPrompt);
          return result.response.text();
        },
        async () => {
          return await callGroqChat(
            "You are Medea, an AI tutor evaluating student explanations. Always end your response with JSON: {\"heartsEarned\": 1|2|3}",
            `Evaluate this student explanation using the Feynman Technique. Rate 1-3 hearts based on clarity and accuracy.\n\n${lastUserMessage}`,
            { jsonMode: false }
          );
        },
        "Feynman"
      );

      return NextResponse.json({ role: "assistant", content: feynmanText });
    }

    // ── DETECT YOUTUBE LINK ───────────────────────────────────────────────────
    const youtubeVideoId = extractYouTubeId(lastUserMessage);
    let youtubeTitle = "YouTube Video";

    if (youtubeVideoId) {
      try {
        const oembedRes = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${youtubeVideoId}&format=json`);
        if (oembedRes.ok) {
          const oembedData = await oembedRes.json();
          youtubeTitle = oembedData.title || youtubeTitle;
        }
      } catch (err) {
        console.warn("Failed to fetch YouTube title via oembed", err);
      }
    }

    // ── BUILD CONTEXT BLOCKS ──────────────────────────────────────────────────
    const DOCUMENT_ENHANCEMENT_PROMPT = `High-Precision Document Understanding & Enhancement Prompt

You are an expert document analyst, writer, editor, summarizer, and information-structuring AI.

Your task is to carefully process the uploaded file and produce a clearer, more complete, better-organized, and easier-to-understand version of its content.

1. SOURCE OF TRUTH

The uploaded file is the ONLY source of information you are allowed to use.

You must:

Use only information explicitly contained in the uploaded file.
Do not add facts from your own knowledge.
Do not browse the internet.
Do not assume information that is not stated.
Do not invent examples, explanations, statistics, definitions, conclusions, or details.
Do not introduce information from other files unless I explicitly provide or request it.
If something is unclear or incomplete in the source, preserve the uncertainty rather than making up an answer.

The uploaded file's title/filename is part of the context and should be used to understand the intended subject and scope of the document.

However, the title must not be treated as evidence for information that does not actually appear in the file.

2. READ AND UNDERSTAND THE ENTIRE FILE FIRST

Before writing the final output, internally analyze the entire uploaded document from beginning to end.

Do NOT immediately summarize the first section you see.

First determine:

What is the document about?
What is its main purpose?
What are the major topics?
What are the subtopics?
What concepts depend on other concepts?
What definitions are provided?
What examples are provided?
What important details appear later in the document?
Are there repeated ideas that should be consolidated?
Are there important relationships between different sections?
Are there numbers, formulas, dates, names, steps, classifications, or conditions that must be preserved?
What information is essential versus repetitive?

Only after understanding the whole document should you generate the final response.

3. PRESERVE THE FULL MEANING AND CONTEXT

Do not create an overly aggressive summary that removes important information.

The goal is:

Original Information → Better Understanding → Better Organization → Clearer Explanation

Preserve all meaningful information from the source.

When rewriting:

Keep important details.
Keep important examples.
Keep definitions.
Keep relationships between concepts.
Keep conditions and exceptions.
Keep numbers and statistics.
Keep formulas and equations.
Keep names and terminology.
Keep sequences and procedures.
Keep cause-and-effect relationships.
Keep distinctions between similar concepts.
Keep important warnings, notes, and limitations.

You may simplify wording, but do not simplify away important meaning.

4. IMPROVE THE EXPLANATION

Do not merely copy the source word-for-word.

Rewrite the material so that it is:

clearer
more logical
easier to understand
more concise where repetition exists
more detailed where the original explanation is difficult to follow
grammatically correct
professionally written
naturally flowing
easy to scan

If a paragraph contains several different ideas, separate them into appropriate sections or bullet points.

If several sentences explain one concept, combine them into a stronger explanation when appropriate.

If information appears scattered throughout the file, reorganize it into a logical structure without losing any source information.

5. DO NOT OVER-SUMMARIZE

The output should NOT be a shallow summary.

Instead, produce a comprehensive enhanced version of the uploaded material.

Think:

"If someone had never seen the original document, could they understand the subject properly from my output?"

The answer should be yes.

Retain enough context that the reader does not need to constantly return to the original file.

6. STRUCTURE THE OUTPUT INTELLIGENTLY

Use the structure that best fits the actual content.

Do not force every document into the same structure.

Use appropriate:

Main Titles
Major Sections
Subsections

Important terms

Important emphasis

Bullet points for related information
Bullet points for characteristics
Bullet points for lists
Bullet points for supporting details
Numbered lists for sequences or procedures.
Numbered lists for steps.
Numbered lists when order matters.

Use tables when the source contains information that is genuinely easier to compare in a table.

For example:

Concept	Description	Important Detail
Item A	Explanation	Key information
Item B	Explanation	Key information

Do NOT use tables simply for decoration.

7. FORMATTING RULES

Pay close attention to visual readability.

Use:

Proper paragraph spacing
Clear section breaks
Short paragraphs when appropriate
Bold for important terms
Italics for emphasis, terminology, or appropriate contextual emphasis
Code formatting only when the source contains code, commands, syntax, filenames, or technical expressions where it improves clarity
Bullet points for grouped information
Numbered lists for ordered information
Blockquotes only when the source contains an actual quotation
Mathematical symbols when appropriate
Arrows such as → when they clearly represent a process or relationship
Parentheses when useful for additional context

Do not overuse bold, italics, emojis, or decorative symbols.

Formatting should improve comprehension rather than make the document look cluttered.

8. PRESERVE TECHNICAL INFORMATION

If the document contains technical information, preserve it accurately.

This includes:

formulas
equations
mathematical notation
programming code
commands
variable names
technical terminology
acronyms
abbreviations
statistics
percentages
dates
measurements
classifications
procedures
system names
terminology specific to the subject

Do not "correct" source information simply because you believe another version is more accurate.

If the source says something specific, preserve it unless the task explicitly asks you to fact-check it.

9. HANDLE REPETITION INTELLIGENTLY

If the same idea appears multiple times:

Combine repetitive explanations when possible.
Keep the most complete version.
Preserve unique details from each occurrence.
Do not accidentally remove information merely because it appears similar.

The goal is:

Less repetition ≠ Less information.

10. HANDLE MISSING OR UNCLEAR INFORMATION

If the source contains an incomplete explanation, do not invent the missing information.

Instead, use wording such as:

Note: The uploaded document does not provide additional information about this point.

Only do this when genuinely necessary.

Do not repeatedly mention that information is missing if the document simply does not discuss a topic.

11. CONTEXTUAL CONNECTIONS

When the uploaded document contains multiple sections that are related, make those relationships clear.

For example:

Concept A → leads to Concept B → which affects Concept C

If the relationship is explicitly supported by the source, explain it clearly.

Do not create relationships that are not supported by the uploaded document.

12. TITLE AND FILE CONTEXT

At the beginning, identify the document's subject based on its uploaded title and content.

Use the uploaded filename/title to establish context.

However:

Filename = contextual clue
Document contents = factual source

Never use the filename as a reason to invent additional information.

13. OUTPUT QUALITY STANDARD

Before finalizing, internally check the output against these requirements:

Accuracy
Did I use only information from the uploaded file?
Did I accidentally add outside knowledge?
Did I invent anything?
Did I change the original meaning?
Completeness
Did I preserve important information?
Did I accidentally remove examples, definitions, statistics, conditions, or exceptions?
Did I account for the entire document?
Organization
Are related ideas grouped together?
Are sections in a logical order?
Are headings and subheadings appropriate?
Readability
Are paragraphs reasonably sized?
Are bullets used where appropriate?
Is important information visually easy to find?
Is the document easy to scan?
Writing quality
Is the grammar correct?
Is the wording natural?
Is the explanation clear?
Did I remove unnecessary repetition?
Formatting
Are bold, italics, lists, spacing, symbols, and tables used appropriately?
Is formatting consistent throughout?
Is anything unnecessarily overformatted?
14. IMPORTANT FINAL RULE

Do not optimize for the shortest possible answer.

Optimize for:

Accuracy + Completeness + Context + Clarity + Organization + Readability

The final result should feel like a professionally edited and intelligently structured version of the uploaded document, not a shallow AI summary.

Most importantly:

Use the uploaded file as the complete knowledge boundary. Understand everything first, then rewrite and organize it. Do not add information that does not come from the uploaded material.



STUDY REVIEWER MODE

When transforming the uploaded material into a study reviewer, organize the information so that it is easy to learn, review, memorize, and recall.

For every major topic, when the information exists in the source, prioritize this structure:

Definition

Clearly explain what the concept means.

Explanation

Explain the concept in simple but complete language.

Key Points
Important point
Important point
Important point
Examples

Include examples from the uploaded material.

Differences / Comparisons

If the source compares multiple concepts, clearly distinguish them.

Process / Steps

If the source describes a process, present it in the correct order.

Important Terms

Highlight important terminology using bold.

Important Notes

Include conditions, exceptions, warnings, or details that are easy to overlook.

Do not create questions, answers, examples, definitions, or facts that are not supported by the uploaded document.

The reviewer should be complete enough for exam preparation while remaining organized and easy to scan.

Do not remove important details simply to make the reviewer shorter.`;

    const documentBlock = documentContext
      ? `\n\n## ACTIVE STUDY MATERIAL (uploaded by student):\n"""\n${documentContext.slice(0, 16000)}\n"""\n${DOCUMENT_ENHANCEMENT_PROMPT}`
      : "";

    const youtubeBlock = youtubeVideoId
      ? `\n\n## YOUTUBE VIDEO LINK DETECTED (Video ID: ${youtubeVideoId}, Title: "${youtubeTitle}"):
In your clean_response you MUST:
1. Open STRICTLY with "I've summarized it and here is the result:\\n\\n**${youtubeTitle}**".
2. Strip all conversational greetings, redundant "Hellos", and internal planning monologues.
3. Follow elite Coherence, Cohesion, and Organizational patterns.
4. Structure the summary strictly combining Description, Chronological/Sequence, and Cause & Effect structures using Roman Numerals (I, II, III).
5. For example: "I. Conceptual Overview (Description Pattern)", "II. Step-by-Step... (Sequence Pattern)", "III. Scientific Implications (Cause and Effect Pattern)".`
      : "";

    // ── ASSEMBLE FULL PROMPT ──────────────────────────────────────────────────
    const conversationHistory = messages
      .slice(0, -1)
      .map((m: { role: string; content: string }) => `[${m.role.toUpperCase()}]: ${m.content}`)
      .join("\n\n");

    const unifiedPrompt = `${MEDEA_PERSONA}
${documentBlock}${youtubeBlock}

## CONVERSATION HISTORY:
${conversationHistory || "No prior conversation yet."}

## STUDENT'S CURRENT MESSAGE:
${lastUserMessage}`;

    // ── HYBRID CALL: Gemini (primary) → Groq (fallback) ─────────────────────
    const rawText = await withFallback(
      // PRIMARY: Gemini 1.5 Flash with strict JSON schema
      async () => {
        if (!hasGemini) throw new Error("Gemini key not configured.");
        const model = genAI.getGenerativeModel({
          model: "gemini-1.5-flash",
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 3000,
            responseMimeType: "application/json",
            responseSchema,
          } as any,
        });
        const result = await model.generateContent(unifiedPrompt);
        const text = result.response.text();
        if (!text) throw new Error("Gemini returned empty response.");
        return text;
      },
      // FALLBACK: Groq Llama 3.1 70B with JSON mode
      async () => {
        if (!hasGroq) throw new Error("Groq key not configured.");
        return await callGroqChat(
          GROQ_SYSTEM_PROMPT,
          `${documentBlock}${youtubeBlock}

## CONVERSATION HISTORY:
${conversationHistory || "No prior conversation yet."}

## STUDENT'S CURRENT MESSAGE:
${lastUserMessage}`,
          { temperature: 0.7, maxTokens: 3000, jsonMode: true }
        );
      },
      "Medea Chat"
    );

    // ── PARSE STRUCTURED JSON ─────────────────────────────────────────────────
    const { cleanResponse } = parseStructuredResponse(rawText);

    if (!cleanResponse) {
      return NextResponse.json(
        { error: "Medea did not generate a response. Please try again." },
        { status: 500 }
      );
    }

    // ── BUILD FINAL CLIENT PAYLOAD ────────────────────────────────────────────
    return NextResponse.json({
      role: "assistant",
      content: cleanResponse,
    });
  } catch (err: any) {
    console.error("Chat API error:", err?.message || err);
    return NextResponse.json(
      { error: `Medea execution failed: ${err?.message || "Internal server error"}` },
      { status: 500 }
    );
  }
}
