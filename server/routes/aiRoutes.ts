import { Router } from 'express';
import { 
  handleAnalyzePapers, 
  handleGenerateAnswer, 
  handleChat, 
  handleStudyStrategy, 
  handleSimplifyAnswer, 
  handleShortAnswer 
} from '../controllers/aiController';

const router = Router();

router.post('/analyze-papers', handleAnalyzePapers);
router.post('/generate-answer', handleGenerateAnswer);
router.post('/chat', handleChat);
router.post('/study-strategy', handleStudyStrategy);
router.post('/simplify-answer', handleSimplifyAnswer);
router.post('/short-answer', handleShortAnswer);

export default router;
