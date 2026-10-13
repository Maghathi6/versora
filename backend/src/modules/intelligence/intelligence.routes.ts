import { Router, RequestHandler } from 'express';
import { IntelligenceController, intelligenceController } from './intelligence.controller';
import { IIntelligenceService } from './intelligence.service';
import { authenticate } from '../../middlewares/auth.middleware';

export function createIntelligenceRouter(
  service?: IIntelligenceService,
  authMiddleware: RequestHandler = authenticate
): Router {
  const router = Router();
  const ctrl = service ? new IntelligenceController(service) : intelligenceController;

  // Protect all intelligence routes with JWT authentication
  router.use(authMiddleware);

  // Artifact Relationships
  router.post('/:projectId/relationships', ctrl.createRelationship);
  router.get('/:projectId/relationships', ctrl.listRelationships);
  router.delete('/:projectId/relationships/:relationshipId', ctrl.deleteRelationship);

  // Traceability for specific artifact
  router.get('/:projectId/artifacts/:artifactId/traceability', ctrl.getArtifactTraceability);

  // Rule-based Change Impact Analysis
  router.get('/:projectId/intelligence/impact', ctrl.getImpactAnalysis);
  router.post('/:projectId/intelligence/impact/review', ctrl.updateImpactReview);

  // Real Project Activity Timeline
  router.get('/:projectId/activities', ctrl.listActivities);

  return router;
}

export const intelligenceRouter = createIntelligenceRouter();
export default intelligenceRouter;
