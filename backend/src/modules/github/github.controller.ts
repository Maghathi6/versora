import { Request, Response, NextFunction } from 'express';
import { GitHubService, gitHubService } from './github.service';
import { env } from '../../config/env';

export class GitHubController {
  constructor(private readonly service: GitHubService = gitHubService) {}

  private getUserId(req: Request): string {
    return (req as unknown as { user: { id: string } }).user.id;
  }

  getOAuthStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const status = await this.service.getOAuthStatus(userId);
      res.status(200).json({ success: true, data: status });
    } catch (err) {
      next(err);
    }
  };

  authorize = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const returnTo = typeof req.query.returnTo === 'string' ? req.query.returnTo : undefined;
      const result = await this.service.generateAuthorizeUrl(userId, returnTo);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };

  callback = async (req: Request, res: Response): Promise<void> => {
    const code = typeof req.query.code === 'string' ? req.query.code : null;
    const state = typeof req.query.state === 'string' ? req.query.state : null;
    const errorParam = typeof req.query.error === 'string' ? req.query.error : null;

    const frontendBase = env.FRONTEND_URL || 'http://localhost:5173';

    if (errorParam || !code || !state) {
      const errorMsg = errorParam || 'GitHub authorization was denied or canceled.';
      res.redirect(`${frontendBase}?github_error=${encodeURIComponent(errorMsg)}`);
      return;
    }

    try {
      const result = await this.service.handleOAuthCallback(code, state);
      const targetUrl = result.returnTo ? `${frontendBase}${result.returnTo}` : frontendBase;
      const separator = targetUrl.includes('?') ? '&' : '?';
      res.redirect(`${targetUrl}${separator}github=connected&username=${encodeURIComponent(result.username)}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to complete GitHub authorization.';
      res.redirect(`${frontendBase}?github_error=${encodeURIComponent(message)}`);
    }
  };

  disconnect = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const result = await this.service.disconnectAccount(userId);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };

  getRemoteStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const status = await this.service.getProjectRemoteStatus(userId, req.params.projectId);
      res.status(200).json({ success: true, data: status });
    } catch (err) {
      next(err);
    }
  };

  publish = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const result = await this.service.publishRepository(userId, req.params.projectId, req.body);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };

  link = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const result = await this.service.linkRepository(userId, req.params.projectId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };

  unlink = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const result = await this.service.unlinkRepository(userId, req.params.projectId);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };

  fetch = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const result = await this.service.fetchRemote(userId, req.params.projectId);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };

  push = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const result = await this.service.push(userId, req.params.projectId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };

  pull = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const result = await this.service.pull(userId, req.params.projectId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };
}

export const githubController = new GitHubController();
