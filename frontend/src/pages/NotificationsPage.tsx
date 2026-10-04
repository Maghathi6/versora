import React from 'react';
import { PageHeader } from '../components/common/PageHeader';
import { EmptyState } from '../components/common/EmptyState';
import { Badge } from '../components/common/Badge';
import { IconNotifications } from '../components/common/Icons';
import { useTerminology } from '../context/TerminologyContext';

export const NotificationsPage: React.FC = () => {
  const { mode } = useTerminology();

  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle="Stay alerted on stale artifacts, impact warnings, and review requests."
        badge={<Badge variant="neutral">Phase 10 Roadmap</Badge>}
      />

      <EmptyState
        icon={<IconNotifications size={28} />}
        phaseBadge="Scheduled for Phase 10: Impact Alerts & Notifications"
        title="No Unread Notifications"
        description={`When an upstream code or dataset artifact is modified, Versora's impact engine will trigger targeted review alerts directly to you, notifying you of which downstream documents or results in your active ${mode === 'beginner' ? 'workspace' : 'branch'} require verification.`}
        technicalNote={`Notifications will support email digests, web push, and in-app alerts powered by the artifact relationship graph.`}
      />
    </div>
  );
};
