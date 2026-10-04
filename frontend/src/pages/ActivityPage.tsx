import React from 'react';
import { PageHeader } from '../components/common/PageHeader';
import { EmptyState } from '../components/common/EmptyState';
import { Badge } from '../components/common/Badge';
import { IconActivity } from '../components/common/Icons';
import { useTerminology } from '../context/TerminologyContext';

export const ActivityPage: React.FC = () => {
  const { mode } = useTerminology();

  return (
    <div>
      <PageHeader
        title="Project Activity"
        subtitle={`Chronological audit log of all ${mode === 'beginner' ? 'saved changes, workspaces, and reviews' : 'commits, branches, and merges'}.`}
        badge={<Badge variant="neutral">Phase 7 Roadmap</Badge>}
      />

      <EmptyState
        icon={<IconActivity size={28} />}
        phaseBadge="Scheduled for Phase 7: Collaboration & Activity Trail"
        title="No Activity Events Recorded"
        description="The live audit trail will track workspace modifications, collaborator actions, and impact analysis triggers once multi-user collaboration and real Git commits are activated."
        technicalNote="Activity events will be persisted to PostgreSQL in the 'activity_events' table and streamed to the UI in real time."
      />
    </div>
  );
};
