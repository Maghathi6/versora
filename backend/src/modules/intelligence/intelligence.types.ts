import { Artifact } from '../artifacts/artifact.types';
import { GitCommitItem } from '../git/git.types';

export type RelationshipType =
  | 'depends_on'
  | 'documents'
  | 'tests'
  | 'generated_from'
  | 'related_to';

export interface ArtifactRelationshipSummary {
  id: string;
  projectId: string;
  sourceArtifactId: string;
  targetArtifactId: string;
  relationshipType: RelationshipType;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  sourceArtifact?: {
    id: string;
    name: string;
    path: string;
    type: string;
    artifactType: string;
  };
  targetArtifact?: {
    id: string;
    name: string;
    path: string;
    type: string;
    artifactType: string;
  };
}

export interface ArtifactTraceabilityData {
  artifact: Artifact;
  outgoingRelationships: ArtifactRelationshipSummary[];
  incomingRelationships: ArtifactRelationshipSummary[];
  gitHistory: GitCommitItem[];
  currentGitStatus: {
    status: 'clean' | 'modified' | 'untracked' | 'deleted';
    staged?: boolean;
    diffSummary?: string;
  };
}

export interface ImpactAnalysisItem {
  impactKey: string;
  changedArtifact: {
    id: string;
    name: string;
    path: string;
    changeType: 'modified' | 'added' | 'deleted';
  };
  affectedArtifact: {
    id: string;
    name: string;
    path: string;
    artifactType: string;
  };
  relationshipType: RelationshipType;
  direction: 'outgoing' | 'incoming';
  reason: string;
  severity: 'high' | 'medium' | 'low' | 'info';
  status: 'active' | 'reviewed' | 'dismissed';
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  notes?: string | null;
}

export interface ImpactAnalysisResponse {
  changedCount: number;
  impactCount: number;
  items: ImpactAnalysisItem[];
  generatedAt: string;
}

export interface ActivityItem {
  id: string;
  projectId: string;
  actorId: string;
  actorUsername?: string;
  actorDisplayName?: string;
  eventType: string;
  entityType: 'artifact' | 'git' | 'github' | 'relationship';
  entityId: string | null;
  summary: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}
