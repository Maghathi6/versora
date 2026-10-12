import { Request, Response, NextFunction } from 'express';
import { IProjectService, projectService } from './project.service';
import { ApiSuccessResponse } from '../../types/api';
import { ProjectResponse } from './project.types';
import { UnauthorizedError } from '../auth/auth.errors';

export class ProjectController {
  private service: IProjectService;

  constructor(service: IProjectService = projectService) {
    this.service = service;
  }

  /**
   * POST /api/v1/projects
   * Creates a new project for the authenticated user.
   */
  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new UnauthorizedError('Authentication token is invalid or missing.');
      }

      const project = await this.service.createProject(userId, req.body);

      const response: ApiSuccessResponse<ProjectResponse> = {
        success: true,
        data: project,
        timestamp: new Date().toISOString(),
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/v1/projects
   * Lists projects owned by the authenticated user.
   */
  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new UnauthorizedError('Authentication token is invalid or missing.');
      }

      const projects = await this.service.listProjects(userId);

      const response: ApiSuccessResponse<ProjectResponse[]> = {
        success: true,
        data: projects,
        timestamp: new Date().toISOString(),
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/v1/projects/:projectId
   * Retrieves a single owned project.
   */
  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new UnauthorizedError('Authentication token is invalid or missing.');
      }

      const project = await this.service.getProject(userId, req.params.projectId);

      const response: ApiSuccessResponse<ProjectResponse> = {
        success: true,
        data: project,
        timestamp: new Date().toISOString(),
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  /**
   * PATCH /api/v1/projects/:projectId
   * Updates name or description of an owned project.
   */
  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new UnauthorizedError('Authentication token is invalid or missing.');
      }

      const updatedProject = await this.service.updateProject(
        userId,
        req.params.projectId,
        req.body
      );

      const response: ApiSuccessResponse<ProjectResponse> = {
        success: true,
        data: updatedProject,
        timestamp: new Date().toISOString(),
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  /**
   * DELETE /api/v1/projects/:projectId
   * Deletes an owned project following safe deletion policy.
   */
  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new UnauthorizedError('Authentication token is invalid or missing.');
      }

      await this.service.deleteProject(userId, req.params.projectId);

      const response: ApiSuccessResponse<{ message: string; id: string }> = {
        success: true,
        data: {
          message: 'Project successfully deleted.',
          id: req.params.projectId,
        },
        timestamp: new Date().toISOString(),
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };
}

export const projectController = new ProjectController();
