import { Request, Response, NextFunction } from 'express';
import { IGitService, gitService } from './git.service';
import { UnauthorizedError } from '../auth/auth.errors';

export class GitController {
  private gitService: IGitService;

  constructor(service: IGitService = gitService) {
    this.gitService = service;
  }

  private getUserId(req: Request): string {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedError('Authentication token is invalid or missing.');
    }
    return userId;
  }

  init = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const result = await this.gitService.initRepository(userId, req.params.projectId);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };

  getStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const result = await this.gitService.getStatus(userId, req.params.projectId);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };

  getDiff = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const file = typeof req.query.file === 'string' ? req.query.file : undefined;
      const staged = req.query.staged === 'true';
      const result = await this.gitService.getDiff(userId, req.params.projectId, { file, staged });
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };

  commit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const result = await this.gitService.commit(userId, req.params.projectId, req.body);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };

  getHistory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
      const branch = typeof req.query.branch === 'string' ? req.query.branch : undefined;
      const path = typeof req.query.path === 'string' ? req.query.path : undefined;
      const result = await this.gitService.getHistory(userId, req.params.projectId, { limit, branch, path });
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };

  getCommit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const result = await this.gitService.getCommit(
        userId,
        req.params.projectId,
        req.params.commitHash
      );
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };

  listBranches = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const result = await this.gitService.listBranches(userId, req.params.projectId);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };

  createBranch = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const result = await this.gitService.createBranch(userId, req.params.projectId, req.body);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };

  switchBranch = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const result = await this.gitService.switchBranch(userId, req.params.projectId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };

  previewRestore = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const result = await this.gitService.previewRestore(userId, req.params.projectId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };

  restore = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const result = await this.gitService.restore(userId, req.params.projectId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };
}

export const gitController = new GitController();
