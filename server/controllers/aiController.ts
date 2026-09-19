import { Request, Response } from 'express';
import { 
  analyzePapers, 
  generateFullAnswer, 
  chatWithAI, 
  generateStudyStrategy 
} from '../../src/services/ai/orchestrator';
import { 
  simplifyAnswer, 
  generateShortAnswer 
} from '../../src/services/ai/generator';

export async function handleAnalyzePapers(req: Request, res: Response) {
  try {
    const { files, contextHint } = req.body;
    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'At least one file is required for analysis.' });
    }
    const result = await analyzePapers(files, contextHint);
    return res.json(result);
  } catch (error: any) {
    console.error('Error in handleAnalyzePapers:', error);
    return res.status(500).json({ 
      error: 'Failed to analyze question papers.', 
      details: error.message || String(error) 
    });
  }
}

export async function handleGenerateAnswer(req: Request, res: Response) {
  try {
    const { questionText, marks, subject } = req.body;
    if (!questionText || !marks || !subject) {
      return res.status(400).json({ error: 'questionText, marks, and subject are required.' });
    }
    const answerData = await generateFullAnswer(questionText, Number(marks), subject);
    return res.json(answerData);
  } catch (error: any) {
    console.error('Error in handleGenerateAnswer:', error);
    return res.status(500).json({ 
      error: 'Failed to generate model answer.', 
      details: error.message || String(error) 
    });
  }
}

export async function handleChat(req: Request, res: Response) {
  try {
    const { questionText, answerText, userMessage, history } = req.body;
    if (!userMessage) {
      return res.status(400).json({ error: 'userMessage is required.' });
    }
    const reply = await chatWithAI(
      questionText || '', 
      answerText || '', 
      userMessage, 
      history || []
    );
    return res.json({ reply });
  } catch (error: any) {
    console.error('Error in handleChat:', error);
    return res.status(500).json({ 
      error: 'Failed to complete chat request.', 
      details: error.message || String(error) 
    });
  }
}

export async function handleStudyStrategy(req: Request, res: Response) {
  try {
    const { result, timeframe } = req.body;
    if (!result) {
      return res.status(400).json({ error: 'result object is required.' });
    }
    const strategy = await generateStudyStrategy(result, timeframe || 'general');
    return res.json({ strategy });
  } catch (error: any) {
    console.error('Error in handleStudyStrategy:', error);
    return res.status(500).json({ 
      error: 'Failed to generate study strategy.', 
      details: error.message || String(error) 
    });
  }
}

export async function handleSimplifyAnswer(req: Request, res: Response) {
  try {
    const { questionText, answerText, marks } = req.body;
    if (!questionText || !answerText || !marks) {
      return res.status(400).json({ error: 'questionText, answerText, and marks are required.' });
    }
    const simplified = await simplifyAnswer(questionText, answerText, Number(marks));
    return res.json({ simplifiedAnswer: simplified });
  } catch (error: any) {
    console.error('Error in handleSimplifyAnswer:', error);
    return res.status(500).json({ 
      error: 'Failed to simplify answer.', 
      details: error.message || String(error) 
    });
  }
}

export async function handleShortAnswer(req: Request, res: Response) {
  try {
    const { questionText, answerText } = req.body;
    if (!questionText || !answerText) {
      return res.status(400).json({ error: 'questionText and answerText are required.' });
    }
    const shortAns = await generateShortAnswer(questionText, answerText);
    return res.json({ shortAnswer: shortAns });
  } catch (error: any) {
    console.error('Error in handleShortAnswer:', error);
    return res.status(500).json({ 
      error: 'Failed to generate short answer.', 
      details: error.message || String(error) 
    });
  }
}
