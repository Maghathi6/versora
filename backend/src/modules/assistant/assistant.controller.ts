import { Request, Response, NextFunction } from 'express';
import { IAssistantService, assistantService } from './assistant.service';
import { ApiSuccessResponse } from '../../types/api';
import { UnauthorizedError } from '../auth/auth.errors';

export class AssistantController {
  constructor(private service: IAssistantService = assistantService) {}

  private getAuthUserId(req: Request): string {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedError('Authentication token is invalid or missing.');
    }
    return userId;
  }

  getConfig = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getAuthUserId(req);
      const { projectId } = req.params;
      const config = await this.service.getConfig(userId, projectId);

      const response: ApiSuccessResponse<typeof config> = {
        success: true,
        data: config,
        timestamp: new Date().toISOString(),
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  listConversations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getAuthUserId(req);
      const { projectId } = req.params;
      const conversations = await this.service.listConversations(userId, projectId);

      const response: ApiSuccessResponse<typeof conversations> = {
        success: true,
        data: conversations,
        timestamp: new Date().toISOString(),
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  createConversation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getAuthUserId(req);
      const { projectId } = req.params;
      const conversation = await this.service.createConversation(userId, projectId, req.body);

      const response: ApiSuccessResponse<typeof conversation> = {
        success: true,
        data: conversation,
        timestamp: new Date().toISOString(),
      };
      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  };

  getConversation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getAuthUserId(req);
      const { projectId, conversationId } = req.params;
      const detail = await this.service.getConversation(userId, projectId, conversationId);

      const response: ApiSuccessResponse<typeof detail> = {
        success: true,
        data: detail,
        timestamp: new Date().toISOString(),
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  renameConversation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getAuthUserId(req);
      const { projectId, conversationId } = req.params;
      const updated = await this.service.renameConversation(userId, projectId, conversationId, req.body);

      const response: ApiSuccessResponse<typeof updated> = {
        success: true,
        data: updated,
        timestamp: new Date().toISOString(),
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  deleteConversation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getAuthUserId(req);
      const { projectId, conversationId } = req.params;
      await this.service.deleteConversation(userId, projectId, conversationId);

      const response: ApiSuccessResponse<{ message: string }> = {
        success: true,
        data: { message: 'Conversation deleted successfully.' },
        timestamp: new Date().toISOString(),
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  sendMessage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getAuthUserId(req);
      const { projectId, conversationId } = req.params;
      const result = await this.service.sendMessage(userId, projectId, conversationId, req.body);

      const response: ApiSuccessResponse<typeof result> = {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  executeQuickAction = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getAuthUserId(req);
      const { projectId } = req.params;
      const result = await this.service.executeQuickAction(userId, projectId, req.body);

      const response: ApiSuccessResponse<typeof result> = {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };
}

export const assistantController = new AssistantController();
