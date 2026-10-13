import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import multer from 'multer';
import { ArtifactController, artifactController } from './artifact.controller';
import { IArtifactService } from './artifact.service';
import { authenticate } from '../../middlewares/auth.middleware';
import { ArtifactValidationError } from './artifact.errors';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB per file
  },
});

/**
 * Express middleware wrapper for multer with normalized domain error mapping.
 */
function createUploadMiddleware() {
  return (req: Request, res: Response, next: NextFunction): void => {
    upload.single('file')(req, res, (err: unknown) => {
      if (err) {
        if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
          return next(
            new ArtifactValidationError([
              { field: 'file', issue: 'Uploaded file exceeds the maximum allowed size limit of 50MB.' },
            ])
          );
        }
        const message = err instanceof Error ? err.message : 'File upload failed.';
        return next(new ArtifactValidationError([{ field: 'file', issue: message }]));
      }
      next();
    });
  };
}

export function createArtifactRouter(
  service?: IArtifactService,
  authMiddleware: RequestHandler = authenticate
): Router {
  const router = Router();
  const controller = service ? new ArtifactController(service) : artifactController;
  const uploadMiddleware = createUploadMiddleware();

  // All endpoints require authentication
  router.use(authMiddleware);

  /**
   * @route   POST /api/v1/projects/:projectId/folders
   * @desc    Create folder in workspace
   */
  router.post('/:projectId/folders', controller.createFolder);

  /**
   * @route   POST /api/v1/projects/:projectId/artifacts
   * @desc    Create new file artifact with empty or initial content
   */
  router.post('/:projectId/artifacts', controller.createArtifact);

  /**
   * @route   POST /api/v1/projects/:projectId/files
   * @desc    Upload file to workspace
   */
  router.post('/:projectId/files', uploadMiddleware, controller.uploadFile);

  /**
   * @route   GET /api/v1/projects/:projectId/artifacts
   * @desc    List files and folders in workspace (with optional ?parentId=...)
   */
  router.get('/:projectId/artifacts', controller.listArtifacts);

  /**
   * @route   GET /api/v1/projects/:projectId/artifacts/:artifactId
   * @desc    Get artifact details
   */
  router.get('/:projectId/artifacts/:artifactId', controller.getArtifact);

  /**
   * @route   GET /api/v1/projects/:projectId/artifacts/:artifactId/download
   * @desc    Download file content
   */
  router.get('/:projectId/artifacts/:artifactId/download', controller.downloadFile);

  /**
   * @route   GET /api/v1/projects/:projectId/artifacts/:artifactId/preview
   * @desc    Stream file content for in-browser visual preview (images, PDF) or return JSON if requested
   */
  router.get('/:projectId/artifacts/:artifactId/preview', controller.previewFile);

  /**
   * @route   GET /api/v1/projects/:projectId/artifacts/:artifactId/preview-data
   * @desc    Get structured rich preview data for artifacts (DOCX, XLSX, PPTX, CSV, media)
   */
  router.get('/:projectId/artifacts/:artifactId/preview-data', controller.getPreviewData);

  /**
   * @route   GET /api/v1/projects/:projectId/artifacts/:artifactId/content
   * @desc    Read text content of artifact for in-browser editor
   */
  router.get('/:projectId/artifacts/:artifactId/content', controller.getArtifactContent);

  /**
   * @route   PUT /api/v1/projects/:projectId/artifacts/:artifactId/content
   * @desc    Update text content of artifact from in-browser editor
   */
  router.put('/:projectId/artifacts/:artifactId/content', controller.updateArtifactContent);

  /**
   * @route   PATCH /api/v1/projects/:projectId/artifacts/:artifactId/rename
   * @desc    Rename file or folder
   */
  router.patch('/:projectId/artifacts/:artifactId/rename', controller.renameArtifact);

  /**
   * @route   PATCH /api/v1/projects/:projectId/artifacts/:artifactId/move
   * @desc    Move file or folder
   */
  router.patch('/:projectId/artifacts/:artifactId/move', controller.moveArtifact);

  /**
   * @route   DELETE /api/v1/projects/:projectId/artifacts/:artifactId
   * @desc    Delete file or folder (cascading child deletions)
   */
  router.delete('/:projectId/artifacts/:artifactId', controller.deleteArtifact);

  /**
   * @route   GET /api/v1/projects/:projectId/overview
   * @desc    Get project workspace summary and artifact stats
   */
  router.get('/:projectId/overview', controller.getOverview);

  return router;
}

const artifactRouter = createArtifactRouter();
export default artifactRouter;
