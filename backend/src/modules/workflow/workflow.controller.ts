import { Request, Response, NextFunction } from 'express';
import { WorkflowService, workflowService } from './workflow.service';
import { SearchCategory } from './workflow.types';

export class WorkflowController {
  constructor(private service: WorkflowService = workflowService) {}

  getDashboard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { projectId } = req.params;
      const userId = req.user!.id;
      const data = await this.service.getProjectDashboard(userId, projectId);
      res.status(200).json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  };

  search = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { projectId } = req.params;
      const userId = req.user!.id;
      const query = String(req.query.q || '');
      const category = (req.query.category as SearchCategory) || 'all';

      const data = await this.service.searchProject(userId, projectId, query, category);
      res.status(200).json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  };

  getContext = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { projectId } = req.params;
      const userId = req.user!.id;
      const artifactId = req.query.artifactId ? String(req.query.artifactId) : undefined;
      const commitHash = req.query.commitHash ? String(req.query.commitHash) : undefined;

      const data = await this.service.getWorkflowContext(userId, projectId, {
        artifactId,
        commitHash,
      });
      res.status(200).json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  };
}

export const workflowController = new WorkflowController();
