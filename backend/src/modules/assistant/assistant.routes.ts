import { Router } from 'express';
import { assistantController, AssistantController } from './assistant.controller';
import { createAuthMiddleware } from '../../middlewares/auth.middleware';

export const projectAssistantRouter = (
  ctrl: AssistantController = assistantController,
  auth = createAuthMiddleware()
): Router => {
  const router = Router({ mergeParams: true });

  // All assistant routes require authentication
  router.use(auth);

  // Config status
  router.get('/:projectId/assistant/config', ctrl.getConfig);

  // Conversations management
  router.get('/:projectId/assistant/conversations', ctrl.listConversations);
  router.post('/:projectId/assistant/conversations', ctrl.createConversation);
  router.get('/:projectId/assistant/conversations/:conversationId', ctrl.getConversation);
  router.patch('/:projectId/assistant/conversations/:conversationId', ctrl.renameConversation);
  router.delete('/:projectId/assistant/conversations/:conversationId', ctrl.deleteConversation);

  // Messages & responses
  router.post('/:projectId/assistant/conversations/:conversationId/messages', ctrl.sendMessage);

  // Context-aware Quick Actions
  router.post('/:projectId/assistant/quick-action', ctrl.executeQuickAction);

  return router;
};

export default projectAssistantRouter();
