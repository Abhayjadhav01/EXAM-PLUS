import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { AnalysisResult, Question, RawQuestion } from "../../types";


export async function analyzePapers(
  files: { data: string; mimeType: string; name: string }[],
  contextHint?: string
): Promise<AnalysisResult> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
  const model = ai.models.generateContent({
    model: "gemini-3.5-flash", 
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
            4. Keep original numbering in the questionReference where possible. Keep MCQ options (A, B, C, D) inside the text property.

            🧠 Master Collection & Semantic Clustering:
            - The main 'questions' array represents the complete QUESTION BANK containing ALL unique questions (both repeated and non-repeated).
            - Identify semantic duplicates (e.g., 'Explain flag register of PIC18' and 'Explain PSW of PIC18' or 'Describe memory hierarchy' and 'Explain RAM/ROM structure of PIC'). These share the same core concepts and must be merged into a single master question in 'questions'.
            - When merging semantic duplicates:
              - Set the 'text' to the most detailed/complete wording variation.
              - Standardize and list all other wording variations inside 'rephrasings'.
              - Set 'repetitionCount' to the exact number of times this question occurred across all papers.
              - Set 'sourcePapers' to contain the exact names of all paper files where this question or its rephrased versions appeared.
            - If questions have different focuses or different concepts (e.g. 'Explain PSW' vs 'Explain Timer 0'), they are separate questions. They MUST be distinct entries in 'questions' with repetitionCount: 1 (unless they repeat elsewhere).
            - Always provide a 'probabilityScore' (0-100, e.g., 94) and 'importance' ("HIGH", "MEDIUM", "LOW") for each question based on frequency, marks weight, and topic significance.
            
            📂 INTELLIGENT UNIT CLASSIFICATION & TOPIC MAPPING:
            - Assign each question to a logically progressional unit ('Unit 1', 'Unit 2', 'Unit 3', 'Unit 4') and group under an intuitive 'topic' (e.g. "UART Communication", "PWM Generation", "LCD Interfacing").
            - If the subject is PIC Microcontrollers, Microcontrollers, or PIC-related, use the following strict mapping:
              - **Unit 1**: PIC Architecture, PIC18, RAM, ROM, Memory Organization, ALU, PSW, Reset Modes, CPU registers (WREG, BSR, etc.), Instruction Set, etc.
              - **Unit 2**: Timers, Counters, PWM, CCP (Capture/Compare/PWM), ADC (Analog-to-Digital Converter), interrupts, capture mode, compare mode, compare match.
              - **Unit 3**: Peripheral Interfacing: LCD, GPIO, LEDs, Keypad, 7-Segment display, Home Protection System, relay interfacing, DAC interfacing, motor interfacing, various sensors, etc.
              - **Unit 4**: Serial & Storage: UART, SPI, I2C, RS232, RS485, EEPROM, RTC (Real-Time Clock), baud rate calculation, serial transmission.
            - For any other subject, perform a logical, balanced division of topics into exactly 4 sequential academic units (Unit 1, Unit 2, Unit 3, Unit 4).

            📊 EXAM PREDICTIONS:
            - Formulate exam-focused predictions:
              1. Top 10 Most Expected/Repeated Questions (literal text).
              2. Most Important Topics (highest cumulative frequencies).
              3. Most Likely Questions for the Next Exam (trend and cycle based predictions).

            Return the result strictly in JSON format.`
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

  const response = await model;
  const text = response.text;
  if (!text) throw new Error("No response from server");

  try {
    return JSON.parse(text) as AnalysisResult;
  } catch (e) {
    console.error("JSON parse failed", e, text);
    const cleaned = text
      .replace(/\\n/g, "\\n")
      .replace(/\\"/g, "\\\"")
      .replace(/[\u0000-\u001F]+/g, " ");
    
    try {
      return JSON.parse(cleaned) as AnalysisResult;
    } catch (e2) {
      throw new Error("The server returned an invalid data format. Try again.");
    }
  }
}

export async function generateFullAnswer(
  questionText: string,
  marks: number,
  subject: string
): Promise<{ answer: string; shortAnswer: string; answerSections: any[]; marksDistribution: any[] }> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
  const model = ai.models.generateContent({
    model: "gemini-3.5-flash",
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
7. ANSWER LENGTH CONTROL
==================================================
Generate exhaustive, highly comprehensive text solutions (never let them be shallow, use MULTIPLE of the structures above to make answers massive, but keep every single bullet/paragraph under 2 lines):
- 2 Marks: Very Short (Definition + 2 Key Points).
- 5 Marks: Moderate (Definition, compact ASCII diagram, Detailed Explanation of 2 main concepts, Advantages, Disadvantages, and formal Conclusion).
- 8 Marks: Detailed (Contents index, Definition, Key Concepts, ASCII diagram/flowchart, Detailed Explanation of 3 concepts, Example, 3 Advantages & Disadvantages, Applications, and formal Conclusion).
- 10 Marks: Comprehensive (Contents index, Definition, Key Concepts, ASCII diagram with step explanation, Detailed Explanation of 4-5 concepts, Example, 4 Advantages & Disadvantages, Applications for at least 3 industries, and formal Conclusion).

==================================================
SUBJECT: ${subject}
QUESTION: ${questionText}
MARKS: ${marks}

OUTPUT FORMAT:
Return a JSON object with:
1. "answer": The full structured answer text, starting with the detected question type block at the absolute top:
"QUESTION TYPE DETECTION: [Detected Category Name]

---
[Your complete formatted answer fitting all rules, containing the Contents index if >=5 marks, visual sections, avoiding markdown header markers or bold asterisks]"
2. "shortAnswer": A crisp 2-sentence summary of the core concept.
3. "answerSections": An array of objects [{"title": "📘 Definition", "content": "...", "type": "text"}, {"title": "🖼 Diagram", "content": "...", "type": "diagram"}, {"title": "📊 Comparison Table", "content": "| Parameter | Item A | Item B |", "type": "table"}, ...] representing the modular structured visual sections. Please ensure you name titles exactly with their selected visual emoji prefix, and configure content format/type strictly. Do not include Memory Trick or Quick Revision sections.
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

  const response = await model;
  return JSON.parse(response.text) as any;
}

export async function chatWithAI(
  question: string, 
  answer: string, 
  userMessage: string, 
  history: { role: "user" | "model"; parts: { text: string }[] }[]
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
  const model = ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
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

  const response = await model;
  return response.text || "I'm sorry, I couldn't process that request.";
}

export async function generateStudyStrategy(result: AnalysisResult, timeframe: string = "general"): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
  const model = ai.models.generateContent({
    model: "gemini-3-flash-preview",
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

  const response = await model;
  return response.text || "Failed to generate study strategy.";
}
