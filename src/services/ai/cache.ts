/**
 * Answer Caching Engine & Controlled Concurrency Pool
 * Minimizes unnecessary AI calls, supports question answer reuse across duplicates,
 * and manages concurrent request limits to prevent throttling.
 */

import { generateQuestionHash, normalizeQuestionText, areQuestionsSimilar } from "./normalizer";

export interface CachedAnswerData {
  answer: string;
  shortAnswer: string;
  answerSections: any[];
  marksDistribution: any[];
  subject: string;
  questionText: string;
  normalizedText: string;
  questionHash: string;
  mode: string;
  cachedAt: number;
}

export interface CacheMetrics {
  totalLookups: number;
  cacheHits: number;
  cacheMisses: number;
  apiCallsSaved: number;
  entriesCount: number;
}

class AnswerCacheManager {
  // In-memory cache map
  private cache: Map<string, CachedAnswerData> = new Map();

  // Metrics
  private totalLookups = 0;
  private cacheHits = 0;
  private cacheMisses = 0;

  constructor() {
    this.initFromLocalStorage();
  }

  private getStorageKey(hash: string): string {
    return `examplus_ans_cache_${hash}`;
  }

  private initFromLocalStorage(): void {
    if (typeof window === "undefined" || !window.localStorage) return;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("examplus_ans_cache_")) {
          const item = localStorage.getItem(key);
          if (item) {
            const data: CachedAnswerData = JSON.parse(item);
            this.cache.set(data.questionHash, data);
          }
        }
      }
    } catch {
      // Ignore local storage errors
    }
  }

  /**
   * Look up an answer by subject, question text, and mode.
   * Performs exact hash lookup first, then semantic fallback lookup.
   */
  public get(
    subject: string,
    questionText: string,
    mode: string = "detailed"
  ): CachedAnswerData | null {
    this.totalLookups++;
    const hash = generateQuestionHash(subject, questionText, mode);

    // 1. Direct Hash Lookup (O(1))
    if (this.cache.has(hash)) {
      this.cacheHits++;
      return this.cache.get(hash)!;
    }

    // 2. Semantic Fallback Check within same subject & mode
    const normQuestion = normalizeQuestionText(questionText);
    const normSubject = (subject || "").toLowerCase().trim();

    for (const cached of this.cache.values()) {
      if (
        cached.mode === mode &&
        cached.subject.toLowerCase() === normSubject
      ) {
        if (areQuestionsSimilar(cached.normalizedText, normQuestion, 0.85)) {
          this.cacheHits++;
          // Cache under this question's hash too for future instant hits
          this.cache.set(hash, {
            ...cached,
            questionText,
            normalizedText: normQuestion,
            questionHash: hash
          });
          return cached;
        }
      }
    }

    this.cacheMisses++;
    return null;
  }

  /**
   * Store an answer in the cache (memory + localStorage when available)
   */
  public set(
    subject: string,
    questionText: string,
    data: {
      answer: string;
      shortAnswer: string;
      answerSections: any[];
      marksDistribution: any[];
    },
    mode: string = "detailed"
  ): CachedAnswerData {
    const hash = generateQuestionHash(subject, questionText, mode);
    const normalizedText = normalizeQuestionText(questionText);

    const entry: CachedAnswerData = {
      ...data,
      subject: (subject || "General").trim(),
      questionText,
      normalizedText,
      questionHash: hash,
      mode,
      cachedAt: Date.now()
    };

    this.cache.set(hash, entry);

    if (typeof window !== "undefined" && window.localStorage) {
      try {
        localStorage.setItem(this.getStorageKey(hash), JSON.stringify(entry));
      } catch {
        // LocalStorage quota might be full; silently continue with in-memory cache
      }
    }

    return entry;
  }

  /**
   * Check if an answer exists without incrementing hit/miss counters
   */
  public has(subject: string, questionText: string, mode: string = "detailed"): boolean {
    const hash = generateQuestionHash(subject, questionText, mode);
    if (this.cache.has(hash)) return true;
    const normQuestion = normalizeQuestionText(questionText);
    const normSubject = (subject || "").toLowerCase().trim();
    for (const cached of this.cache.values()) {
      if (cached.mode === mode && cached.subject.toLowerCase() === normSubject) {
        if (areQuestionsSimilar(cached.normalizedText, normQuestion, 0.85)) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Retrieve current performance and caching metrics
   */
  public getMetrics(): CacheMetrics {
    return {
      totalLookups: this.totalLookups,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      apiCallsSaved: this.cacheHits,
      entriesCount: this.cache.size
    };
  }

  /**
   * Clear all cached answers
   */
  public clear(): void {
    this.cache.clear();
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith("examplus_ans_cache_")) {
            keysToRemove.push(k);
          }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));
      } catch {
        // Ignore
      }
    }
  }
}

export const answerCache = new AnswerCacheManager();

/**
 * Controlled Concurrency Pool Executor
 * Executes an array of async task functions with a maximum concurrency limit.
 * Reports progress as each task finishes and handles partial failures gracefully.
 */
export async function runWithControlledConcurrency<T>(
  tasks: (() => Promise<T>)[],
  concurrencyLimit: number = 3,
  onProgress?: (completed: number, total: number, result?: { success: boolean; data?: T; error?: string }) => void
): Promise<{
  successful: { index: number; data: T }[];
  failed: { index: number; error: string }[];
  total: number;
}> {
  const total = tasks.length;
  if (total === 0) {
    return { successful: [], failed: [], total: 0 };
  }

  const successful: { index: number; data: T }[] = [];
  const failed: { index: number; error: string }[] = [];

  let nextIndex = 0;
  let completedCount = 0;

  async function worker() {
    while (nextIndex < total) {
      const currentIndex = nextIndex++;
      const task = tasks[currentIndex];

      try {
        const res = await task();
        successful.push({ index: currentIndex, data: res });
        completedCount++;
        if (onProgress) {
          onProgress(completedCount, total, { success: true, data: res });
        }
      } catch (err: any) {
        const errorMsg = err?.message || String(err);
        failed.push({ index: currentIndex, error: errorMsg });
        completedCount++;
        if (onProgress) {
          onProgress(completedCount, total, { success: false, error: errorMsg });
        }
      }
    }
  }

  // Spawn up to concurrencyLimit worker promises
  const activeWorkers = Math.min(concurrencyLimit, total);
  const workerPromises = Array.from({ length: activeWorkers }, () => worker());
  await Promise.all(workerPromises);

  // Sort results back to original indices
  successful.sort((a, b) => a.index - b.index);
  failed.sort((a, b) => a.index - b.index);

  return { successful, failed, total };
}
