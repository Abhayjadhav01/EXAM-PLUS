from fastapi import APIRouter, HTTPException, Status
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from services.gemini_orchestrator import (
    analyze_question_papers,
    generate_model_answer,
    run_study_chat,
    generate_study_strategy,
    simplify_answer,
    generate_short_answer
)

router = APIRouter(prefix="/api/ai", tags=["AI Engine"])

class AnalyzePapersRequest(BaseModel):
    files: List[Dict[str, Any]]
    contextHint: Optional[str] = None

class GenerateAnswerRequest(BaseModel):
    questionText: str
    marks: int
    subject: str

class ChatRequest(BaseModel):
    questionText: Optional[str] = ""
    answerText: Optional[str] = ""
    userMessage: str
    history: Optional[List[Dict[str, Any]]] = []

class StudyStrategyRequest(BaseModel):
    result: Dict[str, Any]
    timeframe: Optional[str] = "general"

class SimplifyRequest(BaseModel):
    questionText: str
    answerText: str
    marks: int

class ShortAnswerRequest(BaseModel):
    questionText: str
    answerText: str

@router.post("/analyze-papers")
async def analyze_papers_endpoint(req: AnalyzePapersRequest):
    if not req.files:
        raise HTTPException(
            status_code=Status.HTTP_400_BAD_REQUEST, 
            detail="At least one file is required for analysis."
        )
    try:
        res = await analyze_question_papers(req.files, req.contextHint)
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/generate-answer")
async def generate_answer_endpoint(req: GenerateAnswerRequest):
    try:
        res = await generate_model_answer(req.questionText, req.marks, req.subject)
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/chat")
async def chat_endpoint(req: ChatRequest):
    try:
        reply = await run_study_chat(
            req.questionText or "", 
            req.answerText or "", 
            req.userMessage, 
            req.history or []
        )
        return {"reply": reply}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/study-strategy")
async def study_strategy_endpoint(req: StudyStrategyRequest):
    try:
        strategy = await generate_study_strategy(req.result, req.timeframe or "general")
        return {"strategy": strategy}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/simplify-answer")
async def simplify_answer_endpoint(req: SimplifyRequest):
    try:
        simplified = await simplify_answer(req.questionText, req.answerText, req.marks)
        return {"simplifiedAnswer": simplified}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/short-answer")
async def short_answer_endpoint(req: ShortAnswerRequest):
    try:
        short_ans = await generate_short_answer(req.questionText, req.answerText)
        return {"shortAnswer": short_ans}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

