import { AnalysisResult } from '../types';

async function handleApiResponse(res: Response, defaultErrorMsg: string) {
  if (res.ok) {
    return await res.json();
  }
  let errDetails = '';
  try {
    const errorData = await res.json();
    errDetails = errorData.details || errorData.error || '';
  } catch {
    errDetails = res.statusText;
  }
  throw new Error(errDetails ? `${defaultErrorMsg}: ${errDetails}` : defaultErrorMsg);
}

export async function analyzePapers(
  files: { data: string; mimeType: string; name: string }[],
  contextHint?: string
): Promise<AnalysisResult> {
  const res = await fetch('/api/ai/analyze-papers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files, contextHint }),
  });
  return handleApiResponse(res, 'Failed to analyze question papers');
}

export async function generateFullAnswer(
  questionText: string, 
  marks: number, 
  subject: string,
  options?: { mode?: 'short' | 'medium' | 'detailed'; unit?: string; topic?: string }
) {
  const res = await fetch('/api/ai/generate-answer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      questionText, 
      marks, 
      subject,
      mode: options?.mode,
      unit: options?.unit,
      topic: options?.topic
    }),
  });
  return handleApiResponse(res, 'Failed to generate model answer');
}

export async function batchGenerateAnswers(
  questions: { id: string; text: string; marks: number; unit?: string; topic?: string }[],
  subject: string,
  mode: 'short' | 'medium' | 'detailed' = 'detailed',
  concurrencyLimit: number = 3
) {
  const res = await fetch('/api/ai/batch-generate-answers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questions, subject, mode, concurrencyLimit }),
  });
  return handleApiResponse(res, 'Failed to batch generate answers');
}

export async function getCacheStats() {
  try {
    const res = await fetch('/api/ai/cache-stats');
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // Ignore
  }
  return { metrics: { totalLookups: 0, cacheHits: 0, cacheMisses: 0, apiCallsSaved: 0, entriesCount: 0 } };
}

export async function chatWithAI(
  questionText: string,
  answerText: string,
  userMessage: string,
  history: { role: 'user' | 'model'; parts: { text: string }[] }[] = []
): Promise<string> {
  const res = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questionText, answerText, userMessage, history }),
  });
  const data = await handleApiResponse(res, 'Failed to complete chat request');
  return data.reply;
}

export async function generateStudyStrategy(
  result: AnalysisResult,
  timeframe: string = "general"
): Promise<string> {
  const res = await fetch('/api/ai/study-strategy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ result, timeframe }),
  });
  const data = await handleApiResponse(res, 'Failed to generate study strategy');
  return data.strategy;
}

export async function simplifyAnswer(
  questionText: string,
  answerText: string,
  marks: number
): Promise<string> {
  const res = await fetch('/api/ai/simplify-answer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questionText, answerText, marks }),
  });
  const data = await handleApiResponse(res, 'Failed to simplify answer');
  return data.simplifiedAnswer;
}

export async function generateShortAnswer(
  questionText: string,
  answerText: string
): Promise<string> {
  const res = await fetch('/api/ai/short-answer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questionText, answerText }),
  });
  const data = await handleApiResponse(res, 'Failed to generate short answer');
  return data.shortAnswer;
}
