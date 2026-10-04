import React from 'react';
import { PageHeader } from '../components/common/PageHeader';
import { EmptyState } from '../components/common/EmptyState';
import { Badge } from '../components/common/Badge';
import { IconProjects } from '../components/common/Icons';
import { useTerminology } from '../context/TerminologyContext';

export const ProjectsPage: React.FC = () => {
  const { t, mode } = useTerminology();

  return (
    <div>
      <PageHeader
        title={t('projects')}
        subtitle={`Manage your ${mode === 'beginner' ? 'projects and workspaces' : 'repositories and branches'}.`}
        badge={<Badge variant="neutral">Phase 4 Roadmap</Badge>}
      />

      <EmptyState
        icon={<IconProjects size={28} />}
        phaseBadge="Scheduled for Phase 4: Project Management"
        title={`No ${t('projects')} Provisioned Yet`}
        description={`Project creation will initialize real, bare Git repositories on disk and store relational metadata in PostgreSQL. Fake repositories and mock file trees are intentionally excluded in this foundation phase.`}
        technicalNote={`In Phase 4, the backend will provision bare Git repositories at 'backend/repos/:id.git' and initialize the default '${mode === 'beginner' ? 'main workspace' : 'main branch'}'.`}
      />
    </div>
  );
};
