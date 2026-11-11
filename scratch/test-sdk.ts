import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { GoogleGenAI } from "@google/genai";

async function test() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3.6-flash',
    contents: 'hello',
  });
  console.log("Keys:", Object.keys(response));
  console.log("Type of response.text:", typeof response.text);
  console.log("Text:", response.text);
}
test();
