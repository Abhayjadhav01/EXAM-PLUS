import { AnalysisResult } from '../types';
import { 
  analyzePapers as directAnalyzePapers, 
  chatWithAI as directChatWithAI, 
  generateStudyStrategy as directGenerateStudyStrategy, 
  generateFullAnswer as directGenerateFullAnswer 
} from './ai/orchestrator';
import { 
  simplifyAnswer as directSimplifyAnswer, 
  generateShortAnswer as directGenerateShortAnswer 
} from './ai/generator';

// Full-stack API Client Proxy with Direct Fallback
export async function analyzePapers(
  files: { data: string; mimeType: string; name: string }[],
  contextHint?: string
) {
  try {
    const res = await fetch('/api/ai/analyze-papers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files, contextHint }),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Backend API unavailable, falling back to direct AI execution:', err);
  }
  return directAnalyzePapers(files, contextHint);
}

export async function generateFullAnswer(questionText: string, marks: number, subject: string) {
  try {
    const res = await fetch('/api/ai/generate-answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionText, marks, subject }),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Backend API unavailable, falling back to direct AI execution:', err);
  }
  return directGenerateFullAnswer(questionText, marks, subject);
}

export async function chatWithAI(
  questionText: string,
  answerText: string,
  userMessage: string,
  history: { role: 'user' | 'model'; parts: { text: string }[] }[] = []
) {
  try {
    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionText, answerText, userMessage, history }),
    });
    if (res.ok) {
      const data = await res.json();
      return data.reply;
    }
  } catch (err) {
    console.warn('Backend API unavailable, falling back to direct AI execution:', err);
  }
  return directChatWithAI(questionText, answerText, userMessage, history);
}

export async function generateStudyStrategy(
  result: AnalysisResult,
  timeframe: string = "general"
) {
  try {
    const res = await fetch('/api/ai/study-strategy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ result, timeframe }),
    });
    if (res.ok) {
      const data = await res.json();
      return data.strategy;
    }
  } catch (err) {
    console.warn('Backend API unavailable, falling back to direct AI execution:', err);
  }
  return directGenerateStudyStrategy(result, timeframe);
}

export async function simplifyAnswer(
  questionText: string,
  answerText: string,
  marks: number
) {
  try {
    const res = await fetch('/api/ai/simplify-answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionText, answerText, marks }),
    });
    if (res.ok) {
      const data = await res.json();
      return data.simplifiedAnswer;
    }
  } catch (err) {
    console.warn('Backend API unavailable, falling back to direct AI execution:', err);
  }
  return directSimplifyAnswer(questionText, answerText, marks);
}

export async function generateShortAnswer(
  questionText: string,
  answerText: string
) {
  try {
    const res = await fetch('/api/ai/short-answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionText, answerText }),
    });
    if (res.ok) {
      const data = await res.json();
      return data.shortAnswer;
    }
  } catch (err) {
    console.warn('Backend API unavailable, falling back to direct AI execution:', err);
  }
  return directGenerateShortAnswer(questionText, answerText);
}
