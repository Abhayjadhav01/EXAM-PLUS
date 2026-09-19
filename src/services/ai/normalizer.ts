/**
 * Question Text Normalization, Cleaning, and Duplicate Detection Utility
 * Designed for fast, zero-LLM local processing.
 */

// Common question stop-prefixes that do not change the core concept of the question
const QUESTION_PREFIX_REGEX = /^(?:q(?:uestion)?[\s.:_-]*\d+[\s.:_-]*(?:\([a-z0-9]+\))?|\d+[\s.:_-]*(?:\([a-z0-9]+\))?|\([a-z0-9]+\))\s*/i;

// Regex to detect and strip inline marks indicators like [10 marks], (5M), [7 M], Marks: 10
const MARKS_SUFFIX_REGEX = /(?:\[\s*\d+\s*(?:marks?|m)?\s*\]|\(\s*\d+\s*(?:marks?|m)?\s*\)|\bmarks?\s*[:=]\s*\d+\b|\b\d+\s*marks?\b)\s*$/i;

// Regex for page numbers and footer boilerplate
const BOILERPLATE_REGEX = /(?:page\s*\d+\s*of\s*\d+|time\s*:\s*\d+\s*hours?|max(?:\.|\s+)?marks?\s*:\s*\d+|instructions?\s*:\s*.*$)/gi;

// Common question action stems that can be stripped to find the semantic core
const ACTION_STEMS = [
  /^(?:what\s+is|what\s+are|what\s+do\s+you\s+mean\s+by)\s+/i,
  /^(?:explain|describe|discuss|elaborate|clarify|illustrate)\s+(?:in\s+detail\s+)?(?:about\s+)?/i,
  /^(?:define|give\s+the\s+definition\s+of)\s+/i,
  /^(?:write\s+a\s+short\s+note\s+on|write\s+short\s+notes\s+on|write\s+notes\s+on)\s+/i,
  /^(?:state\s+and\s+explain|state\s+the|state)\s+/i,
  /^(?:differentiate\s+between|distinguish\s+between|compare\s+and\s+contrast|compare)\s+/i,
  /^(?:give\s+the\s+working\s+of|explain\s+the\s+working\s+principle\s+of|explain\s+the\s+architecture\s+of)\s+/i,
];

/**
 * Clean raw text from PDF noise, headers, page numbers, and formatting glitches.
 */
export function cleanExtractedText(text: string): string {
  if (!text) return "";
  return text
    .replace(BOILERPLATE_REGEX, " ")
    .replace(/[\r\t\f]/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Normalizes question text for consistent matching, deduplication, and cache lookup.
 * Example:
 *   "Q.1 (a) What is Cloud Computing? [10 marks]" -> "what is cloud computing"
 *   "1. Explain Cloud Computing." -> "what is cloud computing" (semantic core)
 */
export function normalizeQuestionText(text: string, preserveActionVerb: boolean = false): string {
  if (!text) return "";

  // 1. Remove leading question numbering (Q1., 1(a), (iv))
  let cleaned = text.replace(QUESTION_PREFIX_REGEX, "");

  // 2. Remove trailing marks indicators [10M], (10 marks)
  cleaned = cleaned.replace(MARKS_SUFFIX_REGEX, "");

  // 3. Lowercase & strip surrounding quotes/punctuation
  cleaned = cleaned.toLowerCase().trim();
  cleaned = cleaned.replace(/^["'`“‘]+|["'`”’]+$/g, "");
  cleaned = cleaned.replace(/[.?!,;:]+$/, "");

  // 4. Normalize internal whitespace
  cleaned = cleaned.replace(/\s+/g, " ");

  if (!preserveActionVerb) {
    return cleaned;
  }

  return cleaned;
}

/**
 * Extracts the semantic concept core of a question by removing common action stems.
 * E.g., "Explain the architecture of PIC18" -> "architecture of pic18"
 *       "Describe the architecture of PIC18" -> "architecture of pic18"
 */
export function extractConceptCore(text: string): string {
  let normalized = normalizeQuestionText(text);
  for (const stem of ACTION_STEMS) {
    if (stem.test(normalized)) {
      normalized = normalized.replace(stem, "").trim();
      break;
    }
  }
  return normalized;
}

/**
 * Generates a consistent hash string for caching based on normalized question text and subject.
 */
export function generateQuestionHash(subject: string, questionText: string, mode: string = "standard"): string {
  const normSubject = (subject || "general").toLowerCase().trim();
  const normQuestion = normalizeQuestionText(questionText);
  const rawKey = `${normSubject}:::${normQuestion}:::${mode}`;
  
  // Simple fast string hashing (Fowler-Noll-Vo 1a 32-bit variant)
  let hash = 0x811c9dc5;
  for (let i = 0; i < rawKey.length; i++) {
    hash ^= rawKey.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return `q_${(hash >>> 0).toString(16)}`;
}

/**
 * Tokenize a string into unique words excluding short stop words.
 */
function tokenize(str: string): Set<string> {
  const stopWords = new Set([
    "a", "an", "the", "in", "on", "at", "to", "for", "of", "with", "by", 
    "is", "are", "was", "were", "and", "or", "it", "its", "from", "that", "this"
  ]);
  const words = str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));
  return new Set(words);
}

/**
 * Computes Jaccard token similarity between two questions (0.0 to 1.0).
 */
export function computeTokenSimilarity(textA: string, textB: string): number {
  const tokensA = tokenize(textA);
  const tokensB = tokenize(textB);

  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersection = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) {
      intersection++;
    }
  }

  const union = tokensA.size + tokensB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Checks if two questions are semantic duplicates / highly similar.
 */
export function areQuestionsSimilar(textA: string, textB: string, threshold = 0.72): boolean {
  const normA = normalizeQuestionText(textA);
  const normB = normalizeQuestionText(textB);

  // Exact normalized match
  if (normA === normB) return true;

  // Concept core match (e.g. "Explain cloud computing" vs "What is cloud computing?")
  const coreA = extractConceptCore(textA);
  const coreB = extractConceptCore(textB);
  if (coreA && coreB && coreA === coreB) return true;

  // Jaccard token similarity on normalized text and concept core
  const simNorm = computeTokenSimilarity(normA, normB);
  if (simNorm >= threshold) return true;

  const simCore = computeTokenSimilarity(coreA, coreB);
  return simCore >= threshold;
}

export interface DuplicateGroup<T> {
  canonical: T;
  duplicates: T[];
  canonicalIndex: number;
}

/**
 * Deduplicates and clusters a list of questions locally before sending to AI.
 * Returns unique questions and maps duplicate/similar questions so answers can be shared.
 */
export function clusterQuestions<T extends { text: string; id?: string; marks?: number }>(
  questions: T[]
): {
  uniqueQuestions: T[];
  duplicateCount: number;
  duplicateMap: Map<string, string>; // duplicateText/id -> canonicalText/id
} {
  const uniqueQuestions: T[] = [];
  const duplicateMap = new Map<string, string>();
  let duplicateCount = 0;

  for (const q of questions) {
    const existing = uniqueQuestions.find(u => areQuestionsSimilar(u.text, q.text));
    if (existing) {
      duplicateCount++;
      const sourceKey = q.id || normalizeQuestionText(q.text);
      const targetKey = existing.id || normalizeQuestionText(existing.text);
      duplicateMap.set(sourceKey, targetKey);
    } else {
      uniqueQuestions.push(q);
    }
  }

  return {
    uniqueQuestions,
    duplicateCount,
    duplicateMap
  };
}
