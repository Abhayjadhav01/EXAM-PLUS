import { Router } from 'express';
import { 
  handleAnalyzePapers, 
  handleGenerateAnswer, 
  handleBatchGenerateAnswers,
  handleGetCacheStats,
  handleChat, 
  handleStudyStrategy, 
  handleSimplifyAnswer, 
  handleShortAnswer 
} from '../controllers/aiController';

const router = Router();

router.post('/analyze-papers', handleAnalyzePapers);
router.post('/generate-answer', handleGenerateAnswer);
router.post('/batch-generate-answers', handleBatchGenerateAnswers);
router.get('/cache-stats', handleGetCacheStats);
router.post('/chat', handleChat);
router.post('/study-strategy', handleStudyStrategy);
router.post('/simplify-answer', handleSimplifyAnswer);
router.post('/short-answer', handleShortAnswer);

export default router;
