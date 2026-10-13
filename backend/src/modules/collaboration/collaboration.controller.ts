import { Request, Response, NextFunction } from 'express';
import { ICollaborationService, collaborationService } from './collaboration.service';
import { ApiSuccessResponse } from '../../types/api';
import { UnauthorizedError } from '../auth/auth.errors';

export class CollaborationController {
  constructor(private service: ICollaborationService = collaborationService) {}

  private getAuthUserId(req: Request): string {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedError('Authentication token is invalid or missing.');
    }
    return userId;
  }

  // ==================== MEMBERS & INVITATIONS ====================
  listMembers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getAuthUserId(req);
      const { projectId } = req.params;
      const members = await this.service.listMembers(userId, projectId);
      const response: ApiSuccessResponse<typeof members> = {
        success: true,
        data: members,
        timestamp: new Date().toISOString(),
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  inviteMember = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getAuthUserId(req);
      const { projectId } = req.params;
      const invitation = await this.service.inviteMember(userId, projectId, req.body);
      const response: ApiSuccessResponse<typeof invitation> = {
        success: true,
        data: invitation,
        timestamp: new Date().toISOString(),
      };
      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  };

  listProjectInvitations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getAuthUserId(req);
      const { projectId } = req.params;
      const invitations = await this.service.listProjectInvitations(userId, projectId);
      const response: ApiSuccessResponse<typeof invitations> = {
        success: true,
        data: invitations,
        timestamp: new Date().toISOString(),
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  listUserInvitations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getAuthUserId(req);
      const invitations = await this.service.listUserInvitations(userId);
      const response: ApiSuccessResponse<typeof invitations> = {
        success: true,
        data: invitations,
        timestamp: new Date().toISOString(),
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  acceptInvitation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getAuthUserId(req);
      const { token } = req.params;
      const invitation = await this.service.respondToInvitation(userId, token, 'accept');
      const response: ApiSuccessResponse<typeof invitation> = {
        success: true,
        data: invitation,
        timestamp: new Date().toISOString(),
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  rejectInvitation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getAuthUserId(req);
      const { token } = req.params;
      const invitation = await this.service.respondToInvitation(userId, token, 'reject');
      const response: ApiSuccessResponse<typeof invitation> = {
        success: true,
        data: invitation,
        timestamp: new Date().toISOString(),
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  cancelInvitation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getAuthUserId(req);
      const { projectId, invitationId } = req.params;
      await this.service.cancelInvitation(userId, projectId, invitationId);
      const response: ApiSuccessResponse<{ message: string }> = {
        success: true,
        data: { message: 'Invitation cancelled successfully.' },
        timestamp: new Date().toISOString(),
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  updateMemberRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getAuthUserId(req);
      const { projectId, memberUserId } = req.params;
      const member = await this.service.updateMemberRole(userId, projectId, memberUserId, req.body);
      const response: ApiSuccessResponse<typeof member> = {
        success: true,
        data: member,
        timestamp: new Date().toISOString(),
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  removeMember = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getAuthUserId(req);
      const { projectId, memberUserId } = req.params;
      await this.service.removeMember(userId, projectId, memberUserId);
      const response: ApiSuccessResponse<{ message: string }> = {
        success: true,
        data: { message: 'Member removed successfully.' },
        timestamp: new Date().toISOString(),
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  // ==================== ARTIFACT COMMENTS ====================
  createComment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getAuthUserId(req);
      const { projectId, artifactId } = req.params;
      const comment = await this.service.createComment(userId, projectId, artifactId, req.body);
      const response: ApiSuccessResponse<typeof comment> = {
        success: true,
        data: comment,
        timestamp: new Date().toISOString(),
      };
      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  };

  listArtifactComments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getAuthUserId(req);
      const { projectId, artifactId } = req.params;
      const comments = await this.service.listArtifactComments(userId, projectId, artifactId);
      const response: ApiSuccessResponse<typeof comments> = {
        success: true,
        data: comments,
        timestamp: new Date().toISOString(),
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  updateComment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getAuthUserId(req);
      const { projectId, commentId } = req.params;
      const comment = await this.service.updateComment(userId, projectId, commentId, req.body);
      const response: ApiSuccessResponse<typeof comment> = {
        success: true,
        data: comment,
        timestamp: new Date().toISOString(),
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  deleteComment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getAuthUserId(req);
      const { projectId, commentId } = req.params;
      await this.service.deleteComment(userId, projectId, commentId);
      const response: ApiSuccessResponse<{ message: string }> = {
        success: true,
        data: { message: 'Comment deleted successfully.' },
        timestamp: new Date().toISOString(),
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  resolveComment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getAuthUserId(req);
      const { projectId, commentId } = req.params;
      const comment = await this.service.resolveComment(userId, projectId, commentId, req.body);
      const response: ApiSuccessResponse<typeof comment> = {
        success: true,
        data: comment,
        timestamp: new Date().toISOString(),
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  // ==================== TASKS ====================
  createTask = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getAuthUserId(req);
      const { projectId } = req.params;
      const task = await this.service.createTask(userId, projectId, req.body);
      const response: ApiSuccessResponse<typeof task> = {
        success: true,
        data: task,
        timestamp: new Date().toISOString(),
      };
      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  };

  getTask = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getAuthUserId(req);
      const { projectId, taskId } = req.params;
      const task = await this.service.getTask(userId, projectId, taskId);
      const response: ApiSuccessResponse<typeof task> = {
        success: true,
        data: task,
        timestamp: new Date().toISOString(),
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  listTasks = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getAuthUserId(req);
      const { projectId } = req.params;
      const tasks = await this.service.listTasks(userId, projectId, req.query);
      const response: ApiSuccessResponse<typeof tasks> = {
        success: true,
        data: tasks,
        timestamp: new Date().toISOString(),
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  updateTask = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getAuthUserId(req);
      const { projectId, taskId } = req.params;
      const task = await this.service.updateTask(userId, projectId, taskId, req.body);
      const response: ApiSuccessResponse<typeof task> = {
        success: true,
        data: task,
        timestamp: new Date().toISOString(),
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  deleteTask = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getAuthUserId(req);
      const { projectId, taskId } = req.params;
      await this.service.deleteTask(userId, projectId, taskId);
      const response: ApiSuccessResponse<{ message: string }> = {
        success: true,
        data: { message: 'Task deleted successfully.' },
        timestamp: new Date().toISOString(),
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  createTaskComment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getAuthUserId(req);
      const { projectId, taskId } = req.params;
      const comment = await this.service.createTaskComment(userId, projectId, taskId, req.body);
      const response: ApiSuccessResponse<typeof comment> = {
        success: true,
        data: comment,
        timestamp: new Date().toISOString(),
      };
      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  };

  listTaskComments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getAuthUserId(req);
      const { projectId, taskId } = req.params;
      const comments = await this.service.listTaskComments(userId, projectId, taskId);
      const response: ApiSuccessResponse<typeof comments> = {
        success: true,
        data: comments,
        timestamp: new Date().toISOString(),
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  // ==================== REVIEWS ====================
  createReview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getAuthUserId(req);
      const { projectId } = req.params;
      const review = await this.service.createReview(userId, projectId, req.body);
      const response: ApiSuccessResponse<typeof review> = {
        success: true,
        data: review,
        timestamp: new Date().toISOString(),
      };
      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  };

  getReview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getAuthUserId(req);
      const { projectId, reviewId } = req.params;
      const review = await this.service.getReview(userId, projectId, reviewId);
      const response: ApiSuccessResponse<typeof review> = {
        success: true,
        data: review,
        timestamp: new Date().toISOString(),
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  listReviews = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getAuthUserId(req);
      const { projectId } = req.params;
      const reviews = await this.service.listReviews(userId, projectId);
      const response: ApiSuccessResponse<typeof reviews> = {
        success: true,
        data: reviews,
        timestamp: new Date().toISOString(),
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  updateReview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getAuthUserId(req);
      const { projectId, reviewId } = req.params;
      const review = await this.service.updateReview(userId, projectId, reviewId, req.body);
      const response: ApiSuccessResponse<typeof review> = {
        success: true,
        data: review,
        timestamp: new Date().toISOString(),
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  submitReviewDecision = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getAuthUserId(req);
      const { projectId, reviewId } = req.params;
      const review = await this.service.submitReviewDecision(userId, projectId, reviewId, req.body);
      const response: ApiSuccessResponse<typeof review> = {
        success: true,
        data: review,
        timestamp: new Date().toISOString(),
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  assignReviewers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getAuthUserId(req);
      const { projectId, reviewId } = req.params;
      const review = await this.service.assignReviewers(userId, projectId, reviewId, req.body);
      const response: ApiSuccessResponse<typeof review> = {
        success: true,
        data: review,
        timestamp: new Date().toISOString(),
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  createReviewComment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getAuthUserId(req);
      const { projectId, reviewId } = req.params;
      const comment = await this.service.createReviewComment(userId, projectId, reviewId, req.body);
      const response: ApiSuccessResponse<typeof comment> = {
        success: true,
        data: comment,
        timestamp: new Date().toISOString(),
      };
      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  };

  listReviewComments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getAuthUserId(req);
      const { projectId, reviewId } = req.params;
      const comments = await this.service.listReviewComments(userId, projectId, reviewId);
      const response: ApiSuccessResponse<typeof comments> = {
        success: true,
        data: comments,
        timestamp: new Date().toISOString(),
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  // ==================== NOTIFICATIONS ====================
  listNotifications = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getAuthUserId(req);
      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 50;
      const offset = req.query.offset ? parseInt(String(req.query.offset), 10) : 0;
      const list = await this.service.listNotifications(userId, limit, offset);
      const response: ApiSuccessResponse<typeof list> = {
        success: true,
        data: list,
        timestamp: new Date().toISOString(),
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  getUnreadNotificationCount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getAuthUserId(req);
      const count = await this.service.getUnreadNotificationCount(userId);
      const response: ApiSuccessResponse<{ count: number }> = {
        success: true,
        data: { count },
        timestamp: new Date().toISOString(),
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  markNotificationAsRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getAuthUserId(req);
      const { notificationId } = req.params;
      await this.service.markNotificationAsRead(userId, notificationId);
      const response: ApiSuccessResponse<{ message: string }> = {
        success: true,
        data: { message: 'Notification marked as read.' },
        timestamp: new Date().toISOString(),
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  markAllNotificationsAsRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getAuthUserId(req);
      const count = await this.service.markAllNotificationsAsRead(userId);
      const response: ApiSuccessResponse<{ count: number }> = {
        success: true,
        data: { count },
        timestamp: new Date().toISOString(),
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };
}

export const collaborationController = new CollaborationController();
