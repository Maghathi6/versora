import { Request, Response, NextFunction } from 'express';
import { IArtifactService, artifactService } from './artifact.service';
import { ApiSuccessResponse } from '../../types/api';
import { ArtifactResponse, ArtifactContentResponse } from './artifact.types';
import { ArtifactPreviewResponse } from './artifact.preview';
import { UnauthorizedError } from '../auth/auth.errors';
import { ProjectStats } from './artifact.repository';
import { ProjectResponse, toProjectResponse } from '../projects/project.types';

export class ArtifactController {
  private service: IArtifactService;

  constructor(service: IArtifactService = artifactService) {
    this.service = service;
  }

  /**
   * Helper to retrieve verified user ID from request.
   */
  private getUserId(req: Request): string {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedError('Authentication token is invalid or missing.');
    }
    return userId;
  }

  createFolder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const folder = await this.service.createFolder(userId, req.params.projectId, req.body);

      const response: ApiSuccessResponse<ArtifactResponse> = {
        success: true,
        data: folder,
        timestamp: new Date().toISOString(),
      };
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  };

  createArtifact = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const artifact = await this.service.createArtifact(userId, req.params.projectId, req.body);

      const response: ApiSuccessResponse<ArtifactResponse> = {
        success: true,
        data: artifact,
        timestamp: new Date().toISOString(),
      };
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  };

  uploadFile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const file = req.file;

      if (!file) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'No file provided in upload request.',
            details: [{ field: 'file', issue: 'A file must be attached as multipart field "file".' }],
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const parentId = typeof req.body?.parentId === 'string' ? req.body.parentId : null;

      const artifact = await this.service.uploadFile(
        userId,
        req.params.projectId,
        {
          originalname: file.originalname,
          buffer: file.buffer,
          mimetype: file.mimetype,
          size: file.size,
        },
        parentId
      );

      const response: ApiSuccessResponse<ArtifactResponse> = {
        success: true,
        data: artifact,
        timestamp: new Date().toISOString(),
      };
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  };

  listArtifacts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const parentIdQuery = typeof req.query.parentId === 'string' ? req.query.parentId : undefined;

      const artifacts = await this.service.listArtifacts(userId, req.params.projectId, parentIdQuery);

      const response: ApiSuccessResponse<ArtifactResponse[]> = {
        success: true,
        data: artifacts,
        timestamp: new Date().toISOString(),
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  getArtifact = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const artifact = await this.service.getArtifact(userId, req.params.projectId, req.params.artifactId);

      const response: ApiSuccessResponse<ArtifactResponse> = {
        success: true,
        data: artifact,
        timestamp: new Date().toISOString(),
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  downloadFile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const { artifact, stream } = await this.service.downloadFile(
        userId,
        req.params.projectId,
        req.params.artifactId
      );

      // Safe ASCII filename encoding with fallback
      const safeFilename = encodeURIComponent(artifact.name);
      res.setHeader('Content-Type', artifact.mimeType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"; filename*=UTF-8''${safeFilename}`);
      res.setHeader('Content-Length', artifact.sizeBytes);

      stream.pipe(res);
    } catch (error) {
      next(error);
    }
  };

  previewFile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const acceptsJson = req.headers.accept?.includes('application/json') || req.query.format === 'json';
      if (acceptsJson) {
        return this.getPreviewData(req, res, next);
      }

      const userId = this.getUserId(req);
      const { artifact, stream } = await this.service.previewFile(
        userId,
        req.params.projectId,
        req.params.artifactId
      );

      const mimeType = artifact.mimeType || 'application/octet-stream';
      const safeFilename = encodeURIComponent(artifact.name);

      // Security headers for in-browser visual preview
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Length', artifact.sizeBytes);

      // Prevent script execution in SVGs or untrusted markups
      if (mimeType === 'image/svg+xml') {
        res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
        res.setHeader('Content-Disposition', `inline; filename="${safeFilename}"; filename*=UTF-8''${safeFilename}`);
      } else if (mimeType === 'text/html' || mimeType === 'application/xhtml+xml') {
        // Untrusted HTML must not execute in the application domain
        res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
        res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"; filename*=UTF-8''${safeFilename}`);
      } else {
        res.setHeader('Content-Disposition', `inline; filename="${safeFilename}"; filename*=UTF-8''${safeFilename}`);
      }

      res.setHeader('Content-Type', mimeType);

      stream.on('error', (err) => next(err));
      stream.pipe(res);
    } catch (error) {
      next(error);
    }
  };

  getPreviewData = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const data = await this.service.getArtifactPreviewData(
        userId,
        req.params.projectId,
        req.params.artifactId
      );

      const response: ApiSuccessResponse<ArtifactPreviewResponse> = {
        success: true,
        data,
        timestamp: new Date().toISOString(),
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  getArtifactContent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const data = await this.service.getArtifactContent(
        userId,
        req.params.projectId,
        req.params.artifactId
      );

      const response: ApiSuccessResponse<ArtifactContentResponse> = {
        success: true,
        data,
        timestamp: new Date().toISOString(),
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  updateArtifactContent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const updated = await this.service.updateArtifactContent(
        userId,
        req.params.projectId,
        req.params.artifactId,
        req.body
      );

      const response: ApiSuccessResponse<ArtifactResponse> = {
        success: true,
        data: updated,
        timestamp: new Date().toISOString(),
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  renameArtifact = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const updated = await this.service.renameArtifact(
        userId,
        req.params.projectId,
        req.params.artifactId,
        req.body
      );

      const response: ApiSuccessResponse<ArtifactResponse> = {
        success: true,
        data: updated,
        timestamp: new Date().toISOString(),
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  moveArtifact = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const updated = await this.service.moveArtifact(
        userId,
        req.params.projectId,
        req.params.artifactId,
        req.body
      );

      const response: ApiSuccessResponse<ArtifactResponse> = {
        success: true,
        data: updated,
        timestamp: new Date().toISOString(),
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  deleteArtifact = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const result = await this.service.deleteArtifact(
        userId,
        req.params.projectId,
        req.params.artifactId
      );

      const response: ApiSuccessResponse<{ deletedIds: string[]; message: string }> = {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  getOverview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const { project, stats } = await this.service.getProjectOverview(userId, req.params.projectId);

      const response: ApiSuccessResponse<{
        project: ProjectResponse;
        stats: ProjectStats;
      }> = {
        success: true,
        data: {
          project: toProjectResponse(project),
          stats,
        },
        timestamp: new Date().toISOString(),
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };
}

export const artifactController = new ArtifactController();
