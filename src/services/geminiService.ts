import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function analyzePapers(files: { data: string; mimeType: string; name: string }[]): Promise<AnalysisResult> {
  const model = ai.models.generateContent({
    model: "gemini-3-flash-preview", 
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `Analyze these question papers. 
            1. First, determine if all papers are for the same subject.
            2. If they are the same subject, extract EVERY single question from EVERY paper provided.
            3. Group them by Unit (e.g., Unit 1, Unit 2, Unit I, Unit II) or Section as they appear in the papers.
            4. For each question, provide:
               - The text of the question.
               - Marks assigned.
               - The Unit or Section it belongs to.
               - A comprehensive and detailed answer proportional to the marks. 
                 - Use structured formatting: Use bullet points, numbered lists, and bold text for key concepts.
                 - For high-mark questions, use clear headings to organize the answer.
                 - Avoid long, dense paragraphs.
               - A marks distribution breakdown.
            5. Separately, identify which of these questions are "Repeated" (asking the same thing, even if worded differently).
            
            Return the result strictly in JSON format matching this schema:
            {
              "subject": "string",
              "isSameSubject": boolean,
              "allQuestions": [
                {
                  "id": "string",
                  "text": "string",
                  "marks": number,
                  "unit": "string",
                  "answer": "string",
                  "marksDistribution": [{"point": "string", "marks": number}]
                }
              ],
              "repeatedAnalysis": [
                {
                  "questionText": "string",
                  "repetitionCount": number,
                  "relatedQuestionIds": ["string"]
                }
              ],
              "summary": "string"
            }`
          },
          ...files.map(f => ({
            inlineData: {
              data: f.data.split(',')[1],
              mimeType: f.mimeType
            }
          }))
        ]
      }
    ],
    config: {
      responseMimeType: "application/json",
    }
  });

  const response = await model;
  let text = response.text;
  if (!text) throw new Error("No response from AI");

  // Clean the response text to ensure it's valid JSON
  // 1. Remove markdown code blocks if present
  text = text.replace(/```json\n?|```/g, "").trim();
  
  // 2. Handle potential control characters that might break JSON.parse
  // This replaces unescaped control characters (0-31) with their escaped versions or spaces
  // but we need to be careful not to break valid escapes.
  // A simpler approach is to just try parsing and if it fails, do more aggressive cleaning.
  
  try {
    return JSON.parse(text) as AnalysisResult;
  } catch (e) {
    console.error("Initial JSON parse failed, attempting cleanup...", e);
    
    // Aggressive cleanup for common AI JSON errors:
    // - Remove trailing commas in arrays/objects
    // - Fix invalid escape sequences (backslashes followed by non-escapable chars)
    const cleanedText = text
      .replace(/,\s*([\]}])/g, "$1") // Remove trailing commas
      .replace(/\\([^"\\\/bfnrtu])/g, "$1") // Remove backslashes that don't start a valid escape sequence
      .replace(/[\u0000-\u001F]+/g, (match) => {
        // Replace control characters with spaces, except for common ones like \n \r \t 
        // which should have been escaped by the AI but if they aren't, they are raw control chars.
        return " ";
      });
      
    try {
      return JSON.parse(cleanedText) as AnalysisResult;
    } catch (e2) {
      console.error("Aggressive cleanup also failed", e2);
      throw new Error("The AI returned an invalid data format. Please try again.");
    }
  }
}

export async function simplifyAnswer(question: string, answer: string, marks: number): Promise<string> {
  const model = ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `Simplify the following answer for a student. 
            
            STRICT GUIDELINES:
            1. Keep the depth and detail proportional to the marks (${marks} Marks). If it's a high-mark question, the simplified answer should still be comprehensive.
            2. Use extremely simple words and short sentences.
            3. DO NOT use long paragraphs. Use bullet points, numbered lists, and bold text for key terms to make it very easy to scan and read.
            4. Use clear headings if the answer is long.
            5. The goal is to make it extremely clear for a student who finds the original technical text too complex, but still needs to cover all points to score marks.
            
            Question: ${question}
            Original Answer: ${answer}`
          }
        ]
      }
    ]
  });

  const response = await model;
  return response.text || "Failed to simplify answer.";
}
