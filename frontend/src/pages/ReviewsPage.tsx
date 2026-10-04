import React from 'react';
import { PageHeader } from '../components/common/PageHeader';
import { EmptyState } from '../components/common/EmptyState';
import { Badge } from '../components/common/Badge';
import { IconReviews } from '../components/common/Icons';
import { useTerminology } from '../context/TerminologyContext';

export const ReviewsPage: React.FC = () => {
  const { t, mode } = useTerminology();

  return (
    <div>
      <PageHeader
        title={t('reviews')}
        subtitle={`Inspect, discuss, and approve ${mode === 'beginner' ? 'change requests between workspaces' : 'pull requests between branches'}.`}
        badge={<Badge variant="neutral">Phase 8 Roadmap</Badge>}
      />

      <EmptyState
        icon={<IconReviews size={28} />}
        phaseBadge="Scheduled for Phase 8: Reviews & Change Requests"
        title={`No ${t('changeRequests')} Pending`}
        description={`In Phase 8, you will be able to propose combining workspace changes, inspect visual line diffs, leave inline comments, and approve merges with automated impact analysis reports attached.`}
        technicalNote={`Every ${t('changeRequest')} will automatically calculate an Impact Summary from the directed artifact graph before allowing a merge.`}
      />
    </div>
  );
};
