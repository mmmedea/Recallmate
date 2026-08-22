import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { GoogleGenAI } from "@google/genai";

async function checkModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("No GEMINI_API_KEY found");
    process.exit(1);
  }

  const client = new GoogleGenAI({ apiKey });
  try {
    const response = await client.models.list();
    console.log("Reachable Gemini Models:", response);
  } catch (err: any) {
    console.error("Error listing models:", err.message);
  }
}

checkModels();
