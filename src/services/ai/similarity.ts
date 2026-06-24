import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function detectSimilarity(questions: any[]) {
  // Logic for semantic deduplication
}
