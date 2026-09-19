import { Router } from 'express';
import {
  handleSubmitFeedback,
  handleGetFeedbackList,
  handleGetFeedbackStats,
  handleGetFeedbackById,
  handleUpdateFeedbackStatus,
  handleServeAttachment
} from '../controllers/feedbackController';

const router = Router();

router.post('/', handleSubmitFeedback);
router.get('/', handleGetFeedbackList);
router.get('/stats', handleGetFeedbackStats);
router.get('/:id', handleGetFeedbackById);
router.patch('/:id/status', handleUpdateFeedbackStatus);
router.get('/attachments/:feedbackId/:filename', handleServeAttachment);

export default router;
