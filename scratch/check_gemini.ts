import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { GoogleGenAI } from '@google/genai';

async function main() {
  try {
    console.log("Checking gemini-3.6-flash...");
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: 'Hello!'
    });
    console.log("Success:", response.text);
  } catch (e: any) {
    console.error("Error:", e.message || e);
  }
}
main();
