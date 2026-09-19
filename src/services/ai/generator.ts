import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function simplifyAnswer(question: string, answer: string, marks: number): Promise<string> {
  const model = ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `You are an expert university professor. Simplify the following answer for a student.
The goal is to make it feel human-written, natural, and easy to understand while maintaining exam relevance.

QUESTION: ${question}
ORIGINAL ANSWER: ${answer}
MARKS: ${marks}

STRICT GUIDELINES:
1. Keep the depth proportional to ${marks} marks.
2. Use natural, simple language (not robotic).
3. NO LONG PARAGRAPHS. Use spaced bullet points (• or -) and clear spacing.
4. ❌ DO NOT use Markdown (###, **), LaTeX ($), or code blocks.
5. Use the exact visual icons as headings: 📘 Definition, 📍 Key Points, 🛡 Advantages, 🔌 Disadvantages, 💡 Example, ⚡ Quick Revision. Never use markdown headers like ### or **.
6. 🧮 MATH: 
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
   ✔ Use clean exam format (a₁, x²) and avoid LaTeX.
7. 📐 STRUCTURE CONTROL:
   - For Mathematical questions: Always use vertical step format, Never use paragraph.
   - For Theory questions: Use structured sections (Definition, Points, etc.).
   - For MCQ: 
     ✔ ALWAYS display:
     Question: (Full question clearly)
     Options:
     A) Option 1
     B) Option 2
     C) Option 3
     D) Option 4
     ---
     Correct Answer: (Correct option with label, e.g., B)
     ---
     Explanation:
     • Why the correct option is right
     • Simple and clear reasoning
     ---
     Why other options are wrong:
     • A) Short reason
     • C) Short reason
     • D) Short reason
     ✔ Rules:
     • Do NOT skip options
     • Do NOT rewrite options incorrectly
     • Keep options EXACT if provided
     • If options are NOT given in question: Generate logical options based on concept
     • Format must be clean and exam-like
     • Keep explanation short, concept-based, and easy to understand.
   - Do NOT mix formats.
   - Output must be: Clean, Structured, Easy to scan.
   - Each section must start from a new line.
   - Do not merge all content into one paragraph.
   - Answer should look like: Written in exam sheet, Easy to copy by student.
8. The goal is maximum readability, like a student's clean, structured answer sheet.
9. Leave ONE line gap between sections.
`
          }
        ]
      }
    ]
  });

  const response = await model;
  return response.text || "Failed to simplify answer.";
}

export async function generateShortAnswer(question: string, answer: string): Promise<string> {
  const model = ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `Create a "Short Answer" version of the following model answer.
The goal is to make it feel like a student's quick revision notes—natural and concise.

QUESTION: ${question}
MODEL ANSWER: ${answer}

STRICT GUIDELINES:
1. Organize the short answer starting with 📘 Definition, followed by a ⚡ Quick Revision section containing scannable bullets.
2. ❌ DO NOT use Markdown (###, **), LaTeX ($), or code blocks.
3. Use simple, natural language.
4. Keep it very concise (max 5-6 bullets in total).
5. 🧮 MATH: 
   ❌ DO NOT write in paragraph form.
   ✔ MUST follow vertical step format:
   Given:
   Formula:
   Step 1:
   Step 2:
   Final Answer:
   ✔ Each step must be on a NEW LINE.
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
   ✔ Use clean exam format (a₁, x²) and avoid LaTeX.
6. 📐 STRUCTURE CONTROL:
   - For Mathematical questions: Always use vertical step format, Never use paragraph.
   - For Theory questions: Use structured sections (Definition, Points, etc.).
   - For MCQ: 
     ✔ ALWAYS display:
     Question: (Full question clearly)
     Options:
     A) Option 1
     B) Option 2
     C) Option 3
     D) Option 4
     ---
     Correct Answer: (Correct option with label, e.g., B)
     ---
     Explanation:
     • Why the correct option is right
     • Simple and clear reasoning
     ---
     Why other options are wrong:
     • A) Short reason
     • C) Short reason
     • D) Short reason
     ✔ Rules:
     • Do NOT skip options
     • Do NOT rewrite options incorrectly
     • Keep options EXACT if provided
     • If options are NOT given in question: Generate logical options based on concept
     • Format must be clean and exam-like
     • Keep explanation short, concept-based, and easy to understand.
   - Do NOT mix formats.
   - Output must be: Clean, Structured, Easy to scan.
   - Each section must start from a new line.
   - Do not merge all content into one paragraph.
   - Answer should look like: Written in exam sheet, Easy to copy by student.
7. The goal is quick revision, looking like a student's clean, structured notes.
8. Leave ONE line gap between sections.`
          }
        ]
      }
    ]
  });

  const response = await model;
  return response.text || "Failed to generate short answer.";
}
