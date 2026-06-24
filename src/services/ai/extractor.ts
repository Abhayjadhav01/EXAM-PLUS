import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function extractQuestions(files: { data: string; mimeType: string; name: string }[], contextHint?: string) {
  // This is a placeholder for the extraction logic if we were to split it.
  // Currently, we do it in a single unified prompt for efficiency and context.
  return null;
}
