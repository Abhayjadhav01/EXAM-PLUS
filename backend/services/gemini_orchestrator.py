import os
import json
import logging
from typing import List, Dict, Any, Optional
from google import genai
from google.genai import types

logger = logging.getLogger(__name__)

def get_gemini_client() -> genai.Client:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY environment variable is not set")
    return genai.Client(api_key=api_key)

SYSTEM_PROMPT = """You are Exam Plus AI, an Advanced Educational Answer Generation System, an expert university professor, and a top-tier exam evaluator.
Your goal is to generate HIGH-SCORING UNIVERSITY MODEL ANSWERS that resemble premium topper notes, coaching material, and complete, professional exam handbooks.

Never generate blog-style content.
Never generate textbook-style content.
Never generate large paragraphs.
Strict paragraph size limit: Maximum 2 lines of text per paragraph/bullet point.

PREFERRED SECTION HEADERS:
📘 Definition
📖 Key Concepts
📖 Detailed Explanation
💡 Example
📊 Comparison Table
🔄 Working
🖼 Diagram
📌 Applications
📖 Conclusion
"""

async def analyze_question_papers(files: List[Dict[str, Any]], context_hint: Optional[str] = None) -> Dict[str, Any]:
    client = get_gemini_client()
    
    parts = []
    for idx, f in enumerate(files):
        data_str = f.get("data", "")
        mime_type = f.get("mimeType", "application/pdf")
        name = f.get("name", f"paper_{idx+1}.pdf")
        
        # Add text or binary parts
        parts.append(types.Part.from_bytes(data=data_str.encode('utf-8') if isinstance(data_str, str) else data_str, mime_type=mime_type))
        parts.append(f"Source file label: {name}")

    prompt = f"""
Analyze the attached question paper file(s).
Context hint from student: {context_hint or 'None provided'}

Extract all questions, group identical or rephrased questions into semantic clusters, calculate frequency, repeat probability, weightage, and topic distribution.
Return the result strictly as a valid JSON object matching this schema:
{{
  "subject": "Subject Name",
  "academicLevel": "University Level",
  "totalPapersAnalyzed": {len(files)},
  "paperDetails": [{{"id": "p1", "name": "Paper 1", "year": "2023", "examType": "Semester"}}],
  "topics": [{{"id": "t1", "name": "Topic Name", "weightagePercentage": 25, "totalMarks": 40, "questionCount": 5, "repeatProbability": "High"}}],
  "clusters": [
    {{
      "id": "c1",
      "canonicalQuestion": "Representative Question Text",
      "marks": 10,
      "frequency": 3,
      "repeatProbability": "High",
      "topicName": "Topic Name",
      "instances": [{{"paperName": "2023 Sem", "questionNumber": "Q1a", "rawText": "Exact text", "year": "2023", "marks": 10}}]
    }}
  ]
}}
"""
    parts.append(prompt)
    
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=parts,
        config=types.GenerateContentConfig(
            temperature=0.2,
            response_mime_type="application/json"
        )
    )
    
    return json.loads(response.text)

async def generate_model_answer(question_text: str, marks: int, subject: str) -> Dict[str, Any]:
    client = get_gemini_client()
    
    prompt = f"""
{SYSTEM_PROMPT}

SUBJECT: {subject}
QUESTION: {question_text}
MARKS: {marks}

Generate a comprehensive university model answer for this {marks}-mark question.
Ensure strict adherence to 2-line maximum bullet size, structured visual emoji headers, ASCII diagrams if marks >= 5, and marks distribution rubric.

Return result as JSON:
{{
  "answer": "Complete structured answer string",
  "shortAnswer": "2-sentence quick summary",
  "answerSections": [
    {{"title": "📘 Definition", "content": "...", "type": "text"}},
    {{"title": "🖼 Diagram", "content": "...", "type": "diagram"}}
  ],
  "marksDistribution": [
    {{"point": "Definition & core concept", "marks": 2}}
  ]
}}
"""
    
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
        config=types.GenerateContentConfig(
            temperature=0.3,
            response_mime_type="application/json"
        )
    )
    
    return json.loads(response.text)

async def run_study_chat(question_text: str, answer_text: str, user_message: str, history: List[Dict[str, Any]] = None) -> str:
    client = get_gemini_client()
    
    context = f"Question: {question_text}\nAnswer context: {answer_text}"
    prompt = f"Study Assistant Context:\n{context}\n\nStudent Query: {user_message}\n\nProvide a clear, direct, and encouraging explanation."
    
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
        config=types.GenerateContentConfig(temperature=0.4)
    )
    
    return response.text

async def generate_study_strategy(result: Dict[str, Any], timeframe: str = "general") -> str:
    client = get_gemini_client()
    subject = result.get("subject", "General Subject")
    summary = result.get("summary", "")
    
    prompt = f"""Based on the following PYQ analysis for {subject}, generate an actionable study strategy tailored to the timeframe: {timeframe}.
Summary: {summary}
Requirements:
1. High Priority Units
2. Key Focus Topics
3. Time allocation and actionable tips
Format with clean bullet points and vertical structure."""

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
        config=types.GenerateContentConfig(temperature=0.3)
    )
    return response.text

async def simplify_answer(question_text: str, answer_text: str, marks: int) -> str:
    client = get_gemini_client()
    prompt = f"""Simplify this university model answer for a student to make it intuitive and easy to remember for an exam.
QUESTION: {question_text}
ORIGINAL ANSWER: {answer_text}
MARKS: {marks}
Keep bullet points under 2 lines. Use structured sections: 📘 Definition, 📍 Key Points, 🛡 Advantages, ⚡ Quick Revision."""

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
        config=types.GenerateContentConfig(temperature=0.3)
    )
    return response.text

async def generate_short_answer(question_text: str, answer_text: str) -> str:
    client = get_gemini_client()
    prompt = f"""Generate a concise quick-revision summary of the following answer:
QUESTION: {question_text}
MODEL ANSWER: {answer_text}
Structure: 📘 Core Definition (2 bullets) and ⚡ Rapid Review Points (3 bullets). Maximum 5 bullets total."""

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
        config=types.GenerateContentConfig(temperature=0.3)
    )
    return response.text
