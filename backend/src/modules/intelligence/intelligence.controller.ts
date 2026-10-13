import { Request, Response, NextFunction } from 'express';
import { IIntelligenceService, intelligenceService } from './intelligence.service';
import { UnauthorizedError } from '../auth/auth.errors';

export class IntelligenceController {
  constructor(private service: IIntelligenceService = intelligenceService) {}

  private getUserId(req: Request): string {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedError('Authentication token is invalid or missing.');
    }
    return userId;
  }

  createRelationship = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const projectId = req.params.projectId;
      const rel = await this.service.createRelationship(userId, projectId, req.body);
      res.status(201).json({
        success: true,
        data: rel,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  };

  listRelationships = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const projectId = req.params.projectId;
      const rels = await this.service.listRelationships(userId, projectId);
      res.status(200).json({
        success: true,
        data: rels,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  };

  deleteRelationship = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const projectId = req.params.projectId;
      const relationshipId = req.params.relationshipId;
      const result = await this.service.deleteRelationship(userId, projectId, relationshipId);
      res.status(200).json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  };

  getArtifactTraceability = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const projectId = req.params.projectId;
      const artifactId = req.params.artifactId;
      const data = await this.service.getArtifactTraceability(userId, projectId, artifactId);
      res.status(200).json({
        success: true,
        data,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  };

  getImpactAnalysis = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const projectId = req.params.projectId;
      const data = await this.service.getImpactAnalysis(userId, projectId);
      res.status(200).json({
        success: true,
        data,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  };

  updateImpactReview = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const projectId = req.params.projectId;
      const review = await this.service.updateImpactReview(userId, projectId, req.body);
      res.status(200).json({
        success: true,
        data: review,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  };

  listActivities = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const projectId = req.params.projectId;
      const activities = await this.service.listActivities(userId, projectId, req.query);
      res.status(200).json({
        success: true,
        data: activities,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  };
}

export const intelligenceController = new IntelligenceController();
