import { Type, ThinkingLevel } from "@google/genai";
import { AnalysisResult, Question, RawQuestion } from "../../types";
import { generateContentWithRetry, safeJsonParse } from "./client";
import { answerCache, runWithControlledConcurrency } from "./cache";
import { normalizeQuestionText, areQuestionsSimilar } from "./normalizer";

export async function analyzePapers(
  files: { data: string; mimeType: string; name: string }[],
  contextHint?: string
): Promise<AnalysisResult> {
  const response = await generateContentWithRetry({
    preferredModel: "gemini-3.8-flash",
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `You are an ADVANCED UNIVERSAL PYQ ANALYZER & STRICT DATA EXTRACTOR. Your goal is to extract all questions from the given papers with ZERO LOSS, identify rephrasings, group semantically identical questions, cluster them under common topic headings, and predict exam patterns.
            ${contextHint ? `CONTEXT HINT (from user): ${contextHint}` : ""}

            🚨 EXTRACTION & PAPERS RULES:
            1. We are uploading the following ${files.length} papers. Below are the names of the papers in order of upload:
               ${files.map((f, i) => `- Paper ${i + 1}: "${f.name}"`).join('\n')}
            2. For every question in both 'questions' and 'rawQuestions', you MUST assign 'paperName' and 'sourcePapers' using the EXACT paper filenames provided in the list above (e.g. ${files.map(f => `"${f.name}"`).join(', ')}). Under no circumstances should you lump all questions under just one paper. Ensure "isSameSubject" is true if all papers correspond to the same subject domain.
            3. Do NOT skip any question. Do NOT merge too aggressively. Keep every single unique, meaningful question in the Master Collection ('questions'). Only merge questions that are clear semantic duplicates (questions with the same meaning and answers but slightly different wording).
            4. Keep original numbering in the questionReference where possible. Keep MCQ options (A, B, C, D) inside the text property. Strip out irrelevant header/footer text like page numbers or 'Max Marks 100'.`
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
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          subject: { type: Type.STRING },
          institution: { type: Type.STRING },
          academicContext: { type: Type.STRING },
          metadataConfidence: { type: Type.NUMBER },
          inferredSyllabus: { type: Type.STRING },
          isSameSubject: { type: Type.BOOLEAN },
          questions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                text: { type: Type.STRING, description: "The master/detailed text of the question" },
                topic: { type: Type.STRING, description: "The common topic heading this question falls under (e.g. 'LCD Interfacing')" },
                rephrasings: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Other rephrased versions or different wordings of this same question found in papers" },
                marks: { type: Type.NUMBER },
                unit: { type: Type.STRING, description: "Unit/Section number, e.g. 'Unit 1'" },
                difficulty: { type: Type.STRING, enum: ["easy", "medium", "hard"] },
                isConceptual: { type: Type.BOOLEAN },
                probabilityScore: { type: Type.INTEGER, description: "Predicted likelihood score of appearance in next exam (0-100)" },
                importance: { type: Type.STRING, enum: ["HIGH", "MEDIUM", "LOW"] },
                repetitionCount: { type: Type.NUMBER, description: "Number of times this question (including its rephrasings) was asked" },
                sourcePapers: { type: Type.ARRAY, items: { type: Type.STRING } },
                sourceReferences: { type: Type.ARRAY, items: { type: Type.STRING } },
                linkedQuestionIds: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["id", "text", "topic", "marks", "repetitionCount", "sourcePapers", "unit", "difficulty", "isConceptual", "probabilityScore", "importance"]
            }
          },
          rawQuestions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                text: { type: Type.STRING },
                marks: { type: Type.NUMBER },
                paperName: { type: Type.STRING },
                questionReference: { type: Type.STRING },
                unit: { type: Type.STRING },
                topic: { type: Type.STRING },
                difficulty: { type: Type.STRING, enum: ["easy", "medium", "hard"] },
                isConceptual: { type: Type.BOOLEAN },
                probabilityScore: { type: Type.INTEGER },
                importance: { type: Type.STRING, enum: ["HIGH", "MEDIUM", "LOW"] }
              },
              required: ["text", "marks", "paperName", "unit", "questionReference", "difficulty", "isConceptual", "probabilityScore", "importance"]
            }
          },
          predictions: {
            type: Type.OBJECT,
            properties: {
              top10RepeatedQuestions: { type: Type.ARRAY, items: { type: Type.STRING } },
              importantTopics: { type: Type.ARRAY, items: { type: Type.STRING } },
              nextExamPredictions: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["top10RepeatedQuestions", "importantTopics", "nextExamPredictions"]
          },
          summary: { type: Type.STRING }
        },
        required: ["subject", "isSameSubject", "questions", "rawQuestions", "predictions", "summary"]
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("No response from AI model.");
  const result = safeJsonParse<AnalysisResult>(text, "The server returned an invalid data format. Try again.");

  // Post-processing: Normalize questions, cross-link similar questions, and connect pre-cached answers
  if (result && Array.isArray(result.questions)) {
    const qLen = result.questions.length;
    for (let i = 0; i < qLen; i++) {
      const q1 = result.questions[i];
      if (!q1.linkedQuestionIds) q1.linkedQuestionIds = [];

      // Check answer cache for instant pre-population
      const cached = answerCache.get(result.subject, q1.text, "detailed");
      if (cached) {
        q1.answer = cached.answer;
        q1.shortAnswer = cached.shortAnswer;
        q1.answerSections = cached.answerSections;
        q1.marksDistribution = cached.marksDistribution;
      }

      // Check similarity with other questions to link semantic duplicates
      for (let j = i + 1; j < qLen; j++) {
        const q2 = result.questions[j];
        if (areQuestionsSimilar(q1.text, q2.text)) {
          if (!q1.linkedQuestionIds.includes(q2.id)) q1.linkedQuestionIds.push(q2.id);
          if (!q2.linkedQuestionIds) q2.linkedQuestionIds = [];
          if (!q2.linkedQuestionIds.includes(q1.id)) q2.linkedQuestionIds.push(q1.id);
        }
      }
    }
  }

  return result;
}

export interface AnswerGenerationOptions {
  unit?: string;
  topic?: string;
  mode?: 'short' | 'medium' | 'detailed';
}

export interface AnswerGenerationResult {
  answer: string;
  shortAnswer: string;
  answerSections: any[];
  marksDistribution: any[];
  isFromCache?: boolean;
}

export async function generateFullAnswer(
  questionText: string,
  marks: number,
  subject: string,
  options?: AnswerGenerationOptions
): Promise<AnswerGenerationResult> {
  const targetMode = options?.mode || (marks <= 4 ? "short" : marks <= 8 ? "medium" : "detailed");

  // 1. FAST CACHE LOOKUP: If already generated for this question/mode, return immediately
  const cached = answerCache.get(subject, questionText, targetMode);
  if (cached) {
    return {
      answer: cached.answer,
      shortAnswer: cached.shortAnswer,
      answerSections: cached.answerSections,
      marksDistribution: cached.marksDistribution,
      isFromCache: true
    };
  }

  // 2. CONTEXT OPTIMIZATION & TAILORED PROMPTING BASED ON ANSWER LENGTH MODE
  let modeGuidance = "";
  if (targetMode === "short") {
    modeGuidance = `TARGET MODE: SHORT EXAM REVISION (2-5 Marks)
Keep it crisp, rapid to read, and high-impact (~150-250 words total).
Include:
1. QUESTION TYPE DETECTION
2. 📘 Definition (2-3 precise bullet points)
3. 📖 Key Points (3 core exam points)
4. 💡 Example (1 short illustrative example)
5. 📖 Conclusion (1-2 sentence summary)
Keep all bullets under 2 lines. Do not generate massive diagrams or long comparisons.`;
  } else if (targetMode === "medium") {
    modeGuidance = `TARGET MODE: STANDARD EXAM ANSWER (5-8 Marks)
Keep it well-balanced and structured (~350-500 words total).
Include:
1. QUESTION TYPE DETECTION
2. 📘 Definition
3. 📖 Key Concepts (2 core sub-points with meaning and why important)
4. 💡 Concrete Example
5. ⚖ Advantages & Disadvantages (2-3 points each)
6. 📌 Applications (2 bullet points)
7. 📖 Conclusion (2 wrap-up bullets)`;
  } else {
    modeGuidance = `TARGET MODE: COMPREHENSIVE TOPPER NOTES (10-15+ Marks)
Generate exhaustive, highly comprehensive solutions with full structural sections (~750-1200 words).
Include:
1. QUESTION TYPE DETECTION
2. Contents Index (if >=5 marks)
3. 📘 Definition
4. 📖 Key Concepts
5. 🖼 Diagram (clean ASCII only, with Component Explanation and Working Explanation)
6. 💡 Real-world Scenario / Example
7. 📊 Comparison Table / Matrix
8. ⚖ Numbered Advantages & Disadvantages (3-4 each)
9. 📌 Industry Applications
10. 📖 Conclusion`;
  }

  const response = await generateContentWithRetry({
    preferredModel: "gemini-3.8-flash",
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `You are Exam Plus AI, an Advanced Educational Answer Generation System, an expert university professor, and a top-tier exam evaluator.
Your goal is to generate HIGH-SCORING UNIVERSITY MODEL ANSWERS that resemble premium topper notes, coaching material, and complete, professional exam handbooks.

Never generate blog-style content.
Never generate textbook-style content.
Never generate large paragraphs.

==================================================
1. CHOOSE THE QUESTION TYPE
==================================================
Classify every question into exactly one of the following categories:
- Definition
- Comparison
- Difference
- Features
- Architecture
- Working
- Process
- Algorithm
- Programming
- Numerical
- Design
- Classification
- Theory
- Short Note
- Application

==================================================
2. STRICT STYLING & FORMATTING NEGATIVE RULES (ZERO TOLERANCE)
==================================================
- ❌ NEVER generate or include: Quick Revision sections, Last Minute Revision sections, Viva/Interview Questions, Memory Tricks/Mnemonics/Acronyms, Exam Analytics, Probability Scores, Years Asked, or Frequency Statistics.
- ❌ DO NOT include raw markdown heading symbols like ###, ####, or other numbers of hashes.
- ❌ DO NOT use Markdown bolding like **text** or __text__ under any headers or bullet lists. Keep it clean and unformatted.
- ❌ DO NOT use LaTeX ($) formatting.
- ❌ DO NOT use vertical bar characters "|" in cell contents of tables, as it breaks table formatting.
- ❌ DO NOT include emojis or non-standard unicode characters in the answer text or diagram layouts. Only keep emojis in section titles inside JSON as required (e.g. "📗 Definition").

==================================================
3. PREFERRED SECTION HEADERS
==================================================
Format answer sections exactly using these structured visual header indicators:
📘 Definition
📖 Key Concepts
📖 Detailed Explanation
💡 Example
📊 Comparison Table
🔄 Working
🖼 Diagram
📌 Applications
📖 Conclusion

Only include sections that are genuinely relevant to the subject and answer. Do not force unnecessary sections. No Quick Revision or Memory Trick headers are allowed.

==================================================
4. ANSWER NAVIGATION (FOR LONG ANSWERS)
==================================================
For any answer with marks >= 5, you MUST include a compact Table of Contents right after the QUESTION TYPE DETECTION header:
Contents
• Definition
• Key Concepts
• Detailed Explanation
• Example
• Advantages
• Disadvantages
• Applications
• Conclusion
(Adjust the bullets above to match the actual headers included in your answer).

==================================================
5. DIAGRAM RENDERING SPECIFICATION (ASCII ONLY)
==================================================
- ❌ NEVER use unicode arrow drawing characters like "──►" or "├──" or "└──" or "│" or "º" or "►" inside diagram boxes or text blocks. They cause rendering errors in standard PDF fonts.
- ✔ ONLY use safe standard ASCII characters for flow structures and hierarchy trees.
  - For Process flows, use "-->" or "->". Example: "[Step 1] --> [Step 2] --> [Step 3]"
  - For Hierarchy trees, use standard text formatting, or standard ASCII symbols like "+--" and "|". Example:
    Root
    +-- Option A
    |   +-- Feature A1
    +-- Option B

Every diagram MUST be followed immediately by a detailed:
- Component Explanation (giving the name and role of every block)
- Working Explanation (explaining how flow moves between blocks)

==================================================
6. EXAM PLUS TOPPER NOTES MASTER ENGINE SPECIFICATION
==================================================
Every answer must be exceptionally detailed, structured, and comprehensive. But it must be styled as modern structured topper notes, NOT dense textbook text.

- **STRICT MAXIMUM PARAGRAPH SIZE**: 2 lines of text.
- If any statement or explanation becomes longer than 2 lines, you **MUST** convert it into:
  - Spaced Bullet Points (•) 
  - Numbered Points (1., 2.)
- This is a zero-tolerance negative constraint. Never output blocks of text larger than 2 lines.

Align content format with the detected question type:

1. DEFINITION SECTION:
   - Use exactly 3–5 bullets only. Each bullet should be 1-2 lines.

2. KEY CONCEPTS SECTION:
   - Explain core concepts separately using the following precise layout:
     Key Concept [Number]: [Concept Name]
     Meaning:
     • [Measures uncertainty, etc. Max 2 lines per bullet]
     Why Important:
     • [Helps identify best splits, etc. Max 2 lines per bullet]
     Example:
     • [Real world scenario, etc. Max 2 lines per bullet]

3. DETAILED EXPLANATION SECTION:
   - This is the most important section. Every major concept must follow this exact template:
     [Concept/Sub-topic Name]
     Meaning
     • [Explain in simple, clear language. Max 2 lines]
     How It Works
     • [Step-by-step operational mechanism. Max 2 lines per step]
     Why Important
     • [Explain the exact benefit, purpose, or significance. Max 2 lines]
     Example
     • [Real world example or case study. Max 2 lines]

4. EXAMPLE SECTION:
   - Always provide solid exam-style examples using this layout:
     Scenario:
     • [Real-world situation name and summary. Max 2 lines]
     Input:
     • [Concrete example data. Max 2 lines]
     Output:
     • [Expected outcome/result. Max 2 lines]
     Learning:
     • [Concept takeaway for the student. Max 2 lines]

5. ADVANTAGES SECTION:
   - Use a numbered list. For every advantage, provide a 1-2 line heading and 1-2 line description:
     1. [Advantage Name]
     • [Detailed description of why this benefit occurs. Max 2 lines]

6. DISADVANTAGES SECTION:
   - Use a numbered list. For every disadvantage, provide a 1-2 line heading and 1-2 line description:
     1. [Disadvantage Name]
     • [Detailed description of the limitation. Max 2 lines]

7. APPLICATIONS SECTION:
   - Never use paragraph format. Use this structured layout:
     [Number]. [Industry/Domain Name]
     • [Specific task or operational use case. Max 2 lines]
     • [Tangible benefit or value added. Max 2 lines]

8. COMPARISON QUESTIONS (e.g. Compare K-Means vs K-Medoids):
   - MANDATORY: Generate professional ASCII-only markdown tables.
   - Column layout: Parameter | [Option A] | [Option B]
   - Compare on properties like: Definition, Working Principle, Advantages, Limitations, Applications, Complexity.
   - Cells MUST NOT contain any vertical bars '|' or non-ASCII characters.

9. CHARACTERISTICS QUESTIONS:
   - For every characteristic, structure exactly as:
     [Characteristic Name]
     Meaning:
     • [General definition in simple terms. Max 2 lines]
     Importance:
     • [Why this is crucial. Max 2 lines]
     Example:
     • [Relatable classroom case. Max 2 lines]

10. FEATURES QUESTIONS:
    - For every feature, structure exactly as:
      [Feature Name]
      Purpose:
      • [What it aims to achieve. Max 2 lines]
      Working:
      • [How it functions internally. Max 2 lines]
      Benefit:
      • [The end utility or advantage of this feature. Max 2 lines]

11. TECHNICAL TERMS:
    - Never assume prior knowledge. Every technical term used must be broken down with:
      [Term Name]
      Meaning:
      • [Unpack from first principles. Max 2 lines]

12. CONCLUSION SECTION:
    - A formal Conclusion wrap-up, split into 2-3 clean bullets:
      Conclusion:
      • [Formal high-impact wrap-up summarizing concept importance. Max 2 lines]
      • [Summary of future directions or overall significance. Max 2 lines]

==================================================
4. CONTEXT & ANSWER LENGTH
==================================================
${modeGuidance}

==================================================
SUBJECT: ${subject}
${options?.unit ? `UNIT: ${options.unit}` : ""}
${options?.topic ? `TOPIC: ${options.topic}` : ""}
QUESTION: ${questionText}
MARKS: ${marks}

OUTPUT FORMAT:
Return a JSON object with:
1. "answer": The full structured answer text, starting with the detected question type block at the absolute top:
"QUESTION TYPE DETECTION: [Detected Category Name]

---
[Your complete formatted answer fitting all rules, containing the Contents index if detailed/medium, visual sections, avoiding markdown header markers or bold asterisks]"
2. "shortAnswer": A crisp 2-sentence summary of the core concept.
3. "answerSections": An array of objects [{"title": "📘 Definition", "content": "...", "type": "text"}, {"title": "🖼 Diagram", "content": "...", "type": "diagram"}, {"title": "📊 Comparison Table", "content": "| Parameter | Item A | Item B |", "type": "table"}, ...] representing the modular structured visual sections.
4. "marksDistribution": An array of objects [{"point": "Intro & precise definition", "marks": 2}, ...] showing how to score the full ${marks} marks.

Return the result strictly in JSON format.`
          }
        ]
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          answer: { type: Type.STRING },
          shortAnswer: { type: Type.STRING },
          answerSections: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                content: { type: Type.STRING },
                type: { type: Type.STRING, enum: ["text", "diagram", "example", "table", "summary"] }
              },
              required: ["title", "content", "type"]
            }
          },
          marksDistribution: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                point: { type: Type.STRING },
                marks: { type: Type.NUMBER }
              }
            }
          }
        },
        required: ["answer", "shortAnswer", "answerSections", "marksDistribution"]
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("No response from AI model.");
  const parsed = safeJsonParse<{ answer: string; shortAnswer: string; answerSections: any[]; marksDistribution: any[] }>(
    text,
    "Failed to parse model answer."
  );

  // Store in cache for instant re-use
  answerCache.set(subject, questionText, parsed, targetMode);

  return {
    ...parsed,
    isFromCache: false
  };
}

/**
 * Batch generate answers with duplicate detection, cache check, and controlled concurrency limit
 */
export async function batchGenerateAnswers(
  questions: { id: string; text: string; marks: number; unit?: string; topic?: string }[],
  subject: string,
  mode: 'short' | 'medium' | 'detailed' = 'detailed',
  concurrencyLimit: number = 3,
  onProgress?: (completed: number, total: number, result?: any) => void
): Promise<{
  answers: Record<string, AnswerGenerationResult>;
  stats: {
    total: number;
    cachedCount: number;
    generatedCount: number;
    duplicatesMerged: number;
    failedCount: number;
    durationMs: number;
  };
  failedQuestions: { id: string; text: string; error: string }[];
}> {
  const startTime = Date.now();
  const total = questions.length;
  const answers: Record<string, AnswerGenerationResult> = {};
  const failedQuestions: { id: string; text: string; error: string }[] = [];

  let cachedCount = 0;
  let generatedCount = 0;
  let duplicatesMerged = 0;

  // 1. Group duplicates within the batch so we don't generate the same question twice
  const canonicalMap = new Map<string, string>(); // duplicateId -> canonicalId
  const uniqueQuestionsToProcess: { id: string; text: string; marks: number; unit?: string; topic?: string }[] = [];

  for (const q of questions) {
    const match = uniqueQuestionsToProcess.find(u => areQuestionsSimilar(u.text, q.text));
    if (match) {
      canonicalMap.set(q.id, match.id);
      duplicatesMerged++;
    } else {
      uniqueQuestionsToProcess.push(q);
    }
  }

  // 2. Check cache for unique questions
  const needsGeneration: { id: string; text: string; marks: number; unit?: string; topic?: string }[] = [];
  for (const q of uniqueQuestionsToProcess) {
    const cached = answerCache.get(subject, q.text, mode);
    if (cached) {
      answers[q.id] = {
        answer: cached.answer,
        shortAnswer: cached.shortAnswer,
        answerSections: cached.answerSections,
        marksDistribution: cached.marksDistribution,
        isFromCache: true
      };
      cachedCount++;
    } else {
      needsGeneration.push(q);
    }
  }

  // 3. Create parallel tasks with controlled concurrency for remaining questions
  const tasks = needsGeneration.map(q => async () => {
    const result = await generateFullAnswer(q.text, q.marks, subject, {
      unit: q.unit,
      topic: q.topic,
      mode
    });
    return { id: q.id, ...result };
  });

  const concurrencyResult = await runWithControlledConcurrency(
    tasks,
    concurrencyLimit,
    (completed, taskTotal, progressItem) => {
      if (onProgress) {
        onProgress(cachedCount + completed, total, progressItem);
      }
    }
  );

  for (const succ of concurrencyResult.successful) {
    answers[succ.data.id] = succ.data;
    generatedCount++;
  }

  for (const fail of concurrencyResult.failed) {
    const failedQ = needsGeneration[fail.index];
    failedQuestions.push({
      id: failedQ.id,
      text: failedQ.text,
      error: fail.error
    });
  }

  // 4. Propagate answers to all duplicate questions that were mapped to canonical ones
  for (const [dupId, canonId] of canonicalMap.entries()) {
    if (answers[canonId]) {
      answers[dupId] = {
        ...answers[canonId],
        isFromCache: true
      };
    }
  }

  const durationMs = Date.now() - startTime;

  return {
    answers,
    stats: {
      total,
      cachedCount,
      generatedCount,
      duplicatesMerged,
      failedCount: failedQuestions.length,
      durationMs
    },
    failedQuestions
  };
}

export async function chatWithAI(
  question: string, 
  answer: string, 
  userMessage: string, 
  history: { role: "user" | "model"; parts: { text: string }[] }[]
): Promise<string> {
  const response = await generateContentWithRetry({
    preferredModel: "gemini-3.8-flash",
    contents: [
      {
        role: "user",
        parts: [
          { text: `You are a helpful study companion. You are friendly, natural, and simple in your tone. A student is looking at a specific question and its model answer from their university/board curriculum. 
          
          Question: ${question}
          Model Answer: ${answer}
          
          Help the student understand the topic better. 
          - Tone: Simple, Friendly, Natural.
          - Keep responses: Short, Clear, Context-aware.
          - Answer clearly and concisely using simple language.
          
          STRICT OUTPUT FORMATTING RULES:
          - ❌ DO NOT generate Markdown symbols like ###, **, __.
          - ❌ DO NOT generate code blocks or Mermaid diagrams.
          - ✔ ALWAYS generate CLEAN HUMAN-READABLE TEXT.
          - ✔ Use simple text headings if needed.
          - ✔ Use bullet points (• or -) for lists.
          - ✔ Maintain a clean, structured notes-like appearance.
          - ✔ 🧮 MATH FORMATTING: 
            ❌ DO NOT write in paragraph form.
            ❌ DO NOT explain everything in one block.
            ✔ MUST follow vertical step format:
            Given:
            Formula:
            Step 1:
            Step 2:
            Final Answer:
            ✔ Each step must be on a NEW LINE.
            ✔ One step = one line.
            ✔ Example format:
            Given: a = 1, b = -5, c = 6
            Formula: x = (-b ± √(b² - 4ac)) / 2a
            Step 1: b² = (-5)² = 25
            Step 2: 4ac = 4 × 1 × 6 = 24
            Step 3: √(25 - 24) = √1 = 1
            Step 4: x = (5 ± 1) / 2
            Step 5: x = 3 or x = 2
            Final Answer: x = 2, 3
            ✔ Keep explanation minimal.
            ✔ Focus on solving steps.
            ✔ Use clean exam format (a₁, x²) and avoid LaTeX.` }
        ]
      },
      ...history,
      {
        role: "user",
        parts: [{ text: userMessage }]
      }
    ],
    config: {
      tools: [{ googleSearch: {} }]
    }
  });

  return response.text || "I'm sorry, I couldn't process that request.";
}

export async function generateStudyStrategy(result: AnalysisResult, timeframe: string = "general"): Promise<string> {
  const response = await generateContentWithRetry({
    preferredModel: "gemini-3.8-flash",
    contents: [
      {
        role: "user",
        parts: [{ text: `Based on the following analysis of previous year question papers for the subject "${result.subject}", generate a high-impact study strategy for a student.
        
        TIMEFRAME: ${timeframe === "general" ? "General preparation" : timeframe}
        
        Analysis Summary: ${result.summary}
        Questions and Repetitions: ${JSON.stringify(result.questions.map(q => ({ text: q.text, unit: q.unit, reps: q.repetitionCount })))}
        
        Provide a strategy tailored to the TIMEFRAME:
        1. **High Priority Units**: Which units have the most repeated or high-mark questions?
        2. **Key Focus Topics**: Specific topics that appear frequently.
        3. **Preparation Strategy**: How should the student allocate their time? (Tailor this strictly to the ${timeframe} timeframe)
        4. **Quick Tips**: Short, actionable advice for this specific subject and timeframe.
        
        STRICT OUTPUT FORMATTING RULES:
        - ❌ DO NOT generate Markdown symbols like ###, **, __.
        - ❌ DO NOT generate code blocks or Mermaid diagrams.
        - ✔ ALWAYS generate CLEAN HUMAN-READABLE TEXT.
        - ✔ Use simple text headings like: Title:, Priority:, Focus:, Strategy:, Tips:.
        - ✔ Use bullet points (• or -) for lists.
        - ✔ Formatting rules:
          • Leave ONE line gap between sections.
          • Use bullet points (• or -).
          • Use numbering for steps (1, 2, 3...).
          • Keep each section clearly separated.
        - ✔ Maintain a clean, structured notes-like appearance.
        - ✔ Avoid ALL CAPS; use normal sentence case.
        - ✔ Ensure output looks like a student's clean, structured notes.` }]
      }
    ]
  });

  return response.text || "Failed to generate study strategy.";
}
