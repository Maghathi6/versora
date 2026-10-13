import { Router } from 'express';
import { collaborationController } from './collaboration.controller';
import { authenticate } from '../../middlewares/auth.middleware';

/**
 * Routes scoped under /projects
 */
export const projectCollaborationRouter = Router();

projectCollaborationRouter.use(authenticate);

// Team & Membership
projectCollaborationRouter.get('/:projectId/members', collaborationController.listMembers);
projectCollaborationRouter.post('/:projectId/invitations', collaborationController.inviteMember);
projectCollaborationRouter.get('/:projectId/invitations', collaborationController.listProjectInvitations);
projectCollaborationRouter.delete('/:projectId/invitations/:invitationId', collaborationController.cancelInvitation);
projectCollaborationRouter.patch('/:projectId/members/:memberUserId', collaborationController.updateMemberRole);
projectCollaborationRouter.delete('/:projectId/members/:memberUserId', collaborationController.removeMember);

// Artifact Comments
projectCollaborationRouter.post(
  '/:projectId/artifacts/:artifactId/comments',
  collaborationController.createComment
);
projectCollaborationRouter.get(
  '/:projectId/artifacts/:artifactId/comments',
  collaborationController.listArtifactComments
);
projectCollaborationRouter.patch(
  '/:projectId/comments/:commentId',
  collaborationController.updateComment
);
projectCollaborationRouter.delete(
  '/:projectId/comments/:commentId',
  collaborationController.deleteComment
);
projectCollaborationRouter.patch(
  '/:projectId/comments/:commentId/resolve',
  collaborationController.resolveComment
);

// Tasks & Issues
projectCollaborationRouter.post('/:projectId/tasks', collaborationController.createTask);
projectCollaborationRouter.get('/:projectId/tasks', collaborationController.listTasks);
projectCollaborationRouter.get('/:projectId/tasks/:taskId', collaborationController.getTask);
projectCollaborationRouter.patch('/:projectId/tasks/:taskId', collaborationController.updateTask);
projectCollaborationRouter.delete('/:projectId/tasks/:taskId', collaborationController.deleteTask);
projectCollaborationRouter.post(
  '/:projectId/tasks/:taskId/comments',
  collaborationController.createTaskComment
);
projectCollaborationRouter.get(
  '/:projectId/tasks/:taskId/comments',
  collaborationController.listTaskComments
);

// Reviews & Approvals
projectCollaborationRouter.post('/:projectId/reviews', collaborationController.createReview);
projectCollaborationRouter.get('/:projectId/reviews', collaborationController.listReviews);
projectCollaborationRouter.get('/:projectId/reviews/:reviewId', collaborationController.getReview);
projectCollaborationRouter.patch('/:projectId/reviews/:reviewId', collaborationController.updateReview);
projectCollaborationRouter.post(
  '/:projectId/reviews/:reviewId/decisions',
  collaborationController.submitReviewDecision
);
projectCollaborationRouter.post(
  '/:projectId/reviews/:reviewId/reviewers',
  collaborationController.assignReviewers
);
projectCollaborationRouter.post(
  '/:projectId/reviews/:reviewId/comments',
  collaborationController.createReviewComment
);
projectCollaborationRouter.get(
  '/:projectId/reviews/:reviewId/comments',
  collaborationController.listReviewComments
);

/**
 * Global collaboration routes mounted at root (invitations, notifications)
 */
export const collaborationGlobalRouter = Router();

collaborationGlobalRouter.use(authenticate);

// Global Invitations
collaborationGlobalRouter.get('/invitations/me', collaborationController.listUserInvitations);
collaborationGlobalRouter.post('/invitations/:token/accept', collaborationController.acceptInvitation);
collaborationGlobalRouter.post('/invitations/:token/reject', collaborationController.rejectInvitation);

// Notifications
collaborationGlobalRouter.get('/notifications', collaborationController.listNotifications);
collaborationGlobalRouter.get(
  '/notifications/unread-count',
  collaborationController.getUnreadNotificationCount
);
collaborationGlobalRouter.patch(
  '/notifications/:notificationId/read',
  collaborationController.markNotificationAsRead
);
collaborationGlobalRouter.post(
  '/notifications/mark-all-read',
  collaborationController.markAllNotificationsAsRead
);
