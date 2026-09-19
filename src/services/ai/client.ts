import { GoogleGenAI, GenerateContentParameters, GenerateContentResponse } from "@google/genai";

let aiInstance: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY || "";
    aiInstance = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiInstance;
}

// Fallback model sequence for high resilience against 503 (high demand) and 429
const TEXT_MODELS = [
  "gemini-3.8-flash",
  "gemini-flash-latest",
  "gemini-3.1-flash-lite",
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableError(err: any): boolean {
  if (!err) return false;
  const status = err.status || err.code || err.statusCode;
  const msg = (err.message || String(err)).toLowerCase();
  
  return (
    status === 503 ||
    status === 429 ||
    status === "UNAVAILABLE" ||
    status === "RESOURCE_EXHAUSTED" ||
    msg.includes("high demand") ||
    msg.includes("unavailable") ||
    msg.includes("overloaded") ||
    msg.includes("try again later") ||
    msg.includes("rate limit") ||
    msg.includes("quota")
  );
}

/**
 * Execute generateContent with automatic retry, exponential backoff,
 * and seamless fallback across recommended models if experiencing 503 or 429 spikes.
 */
export async function generateContentWithRetry(
  params: Omit<GenerateContentParameters, "model"> & { preferredModel?: string }
): Promise<GenerateContentResponse> {
  const ai = getGeminiClient();
  const modelsToTry = params.preferredModel 
    ? [params.preferredModel, ...TEXT_MODELS.filter(m => m !== params.preferredModel)]
    : TEXT_MODELS;

  let lastError: any = null;

  for (let mIdx = 0; mIdx < modelsToTry.length; mIdx++) {
    const currentModel = modelsToTry[mIdx];
    const maxRetriesPerModel = mIdx === 0 ? 2 : 1;

    for (let attempt = 0; attempt <= maxRetriesPerModel; attempt++) {
      try {
        const { preferredModel: _, ...restParams } = params;
        const response = await ai.models.generateContent({
          ...restParams,
          model: currentModel,
        });

        if (response && response.text !== undefined) {
          return response;
        }
      } catch (err: any) {
        lastError = err;
        const retryable = isRetryableError(err);
        
        console.warn(
          `[Gemini] Attempt ${attempt + 1} with model "${currentModel}" failed:`,
          err.message || err.status || err
        );

        if (retryable && attempt < maxRetriesPerModel) {
          const delay = (attempt + 1) * 800 + Math.random() * 400;
          await sleep(delay);
          continue;
        }

        // If retryable and we have another fallback model, break inner loop to try next model
        if (retryable && mIdx < modelsToTry.length - 1) {
          console.warn(`[Gemini] Switching to fallback model "${modelsToTry[mIdx + 1]}"...`);
          await sleep(500);
          break;
        }

        // If not retryable (e.g. fatal validation error), throw immediately
        if (!retryable) {
          throw err;
        }
      }
    }
  }

  throw lastError || new Error("All Gemini model attempts exhausted.");
}

/**
 * Clean and safely parse JSON returned by Gemini models
 */
export function safeJsonParse<T>(text: string, fallbackErrorMessage = "Failed to parse model output"): T {
  if (!text || typeof text !== "string") {
    throw new Error(fallbackErrorMessage);
  }

  let cleaned = text.trim();

  // Strip Markdown code fences (```json ... ``` or ``` ...)
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }

  try {
    return JSON.parse(cleaned) as T;
  } catch (err1) {
    // Attempt sanitizing common escaping issues
    try {
      const sanitized = cleaned
        .replace(/\\n/g, "\\n")
        .replace(/\\"/g, '\\"')
        .replace(/[\u0000-\u001F]+/g, " ");
      return JSON.parse(sanitized) as T;
    } catch (err2) {
      console.error("[Gemini] JSON parse failed on text:", text);
      throw new Error(fallbackErrorMessage);
    }
  }
}
