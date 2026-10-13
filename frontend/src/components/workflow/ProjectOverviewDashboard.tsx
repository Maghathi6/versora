import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { workflowService } from '../../services/workflowService';
import { assistantService } from '../../services/assistantService';
import { ProjectDashboardData } from '../../types/workflow';
import { EvidenceReference } from '../../types/assistant';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import {
  IconSparkles,
  IconGitCommit,
  IconTasks,
  IconReviews,
  IconAlertCircle,
  IconArrowRight,
  IconFolder,
  IconCopy,
} from '../common/Icons';

interface ProjectOverviewDashboardProps {
  projectId: string;
  onNavigateTab: (tab: 'files' | 'changes' | 'history' | 'tasks' | 'reviews' | 'team' | 'activity' | 'assistant') => void;
  onInspectArtifact?: (artifactId: string) => void;
  onOpenCreateReview?: () => void;
  onOpenCreateTask?: () => void;
}

export const ProjectOverviewDashboard: React.FC<ProjectOverviewDashboardProps> = ({
  projectId,
  onNavigateTab,
}) => {
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiSources, setAiSources] = useState<EvidenceReference[]>([]);
  const [isGeneratingAi, setIsGeneratingAi] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const {
    data: dashboard,
    isLoading,
    error,
    refetch,
  } = useQuery<ProjectDashboardData>({
    queryKey: ['project-dashboard', projectId],
    queryFn: () => workflowService.getProjectDashboard(projectId),
    staleTime: 10000,
  });

  const handleGenerateSummary = async () => {
    setIsGeneratingAi(true);
    setAiError(null);
    try {
      const res = await assistantService.executeQuickAction(projectId, {
        action: 'project-summary',
      });
      setAiSummary(res.content);
      setAiSources(res.sources || []);
    } catch (err: any) {
      setAiError(err.message || 'Failed to generate AI project summary.');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleCopySummary = () => {
    if (!aiSummary) return;
    navigator.clipboard.writeText(aiSummary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  if (isLoading) {
    return (
      <div style={{ padding: '2rem 0', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          Loading unified project intelligence dashboard...
        </div>
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="card" style={{ padding: '2rem', border: '1px solid var(--status-danger-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--status-danger)', marginBottom: '1rem' }}>
          <IconAlertCircle size={22} />
          <h3 style={{ margin: 0 }}>Failed to load project dashboard</h3>
        </div>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
          {(error as any)?.message || 'An error occurred while loading project metrics.'}
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Retry Loading
        </Button>
      </div>
    );
  }

  const { stats, git, github, pendingReviews, myTasks, impactSummary, aiAssistant } = dashboard;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2.5rem' }}>
      {/* 1. KEY METRICS STATS GRID */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
        }}
      >
        <div className="card" style={{ padding: '1.25rem', cursor: 'pointer' }} onClick={() => onNavigateTab('files')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Files & Assets
            </span>
            <IconFolder size={16} style={{ color: 'var(--text-muted)' }} />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.35rem', color: 'var(--text-primary)' }}>
            {stats.filesCount}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            in {stats.foldersCount} folders ({formatBytes(stats.totalStorageBytes)})
          </span>
        </div>

        <div className="card" style={{ padding: '1.25rem', cursor: 'pointer' }} onClick={() => onNavigateTab('tasks')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Active Tasks
            </span>
            <IconTasks size={16} style={{ color: 'var(--text-muted)' }} />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.35rem', color: 'var(--text-primary)' }}>
            {stats.openTasksCount}
          </div>
          <span style={{ fontSize: '0.75rem', color: stats.urgentTasksCount > 0 ? 'var(--status-danger)' : 'var(--text-secondary)' }}>
            {stats.urgentTasksCount > 0 ? `🔥 ${stats.urgentTasksCount} urgent/high priority` : 'All tasks on schedule'}
          </span>
        </div>

        <div className="card" style={{ padding: '1.25rem', cursor: 'pointer' }} onClick={() => onNavigateTab('reviews')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Pending Reviews
            </span>
            <IconReviews size={16} style={{ color: 'var(--text-muted)' }} />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.35rem', color: 'var(--brand-primary-light)' }}>
            {stats.pendingReviewsCount}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {pendingReviews.filter((r) => r.isAwaitingUser).length > 0
              ? `⚡ ${pendingReviews.filter((r) => r.isAwaitingUser).length} awaiting your decision`
              : 'Collaborative code reviews'}
          </span>
        </div>

        <div className="card" style={{ padding: '1.25rem', cursor: 'pointer' }} onClick={() => onNavigateTab('changes')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Potential Impacts
            </span>
            <IconSparkles size={16} style={{ color: 'var(--text-muted)' }} />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.35rem', color: impactSummary.hasUnreviewedWarning ? 'var(--status-warning)' : 'var(--brand-trace-light)' }}>
            {impactSummary.activeCount}
          </div>
          <span style={{ fontSize: '0.75rem', color: impactSummary.hasUnreviewedWarning ? 'var(--status-warning)' : 'var(--text-secondary)' }}>
            {impactSummary.hasUnreviewedWarning ? `⚠️ ${impactSummary.highSeverityCount} high severity unreviewed` : 'Rule-based change graph'}
          </span>
        </div>
      </div>

      {/* 2. UNREVIEWED IMPACT WARNING BANNER (IF CRITICAL IMPACT DETECTED) */}
      {impactSummary.hasUnreviewedWarning && (
        <div
          style={{
            padding: '1rem 1.25rem',
            background: 'rgba(245, 158, 11, 0.12)',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <IconAlertCircle size={20} style={{ color: 'var(--status-warning)' }} />
            <div>
              <strong style={{ color: 'var(--status-warning)', display: 'block', fontSize: '0.9rem' }}>
                Unreviewed Downstream Impact Detected
              </strong>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Modified artifacts connect to {impactSummary.highSeverityCount} downstream dependencies that have not been reviewed.
              </span>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => onNavigateTab('changes')}>
            Review Changes & Impact
          </Button>
        </div>
      )}

      {/* 3. AI PROJECT INTELLIGENCE SUMMARY CARD */}
      <div
        className="card"
        style={{
          border: '1px solid rgba(99, 102, 241, 0.3)',
          background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.8) 100%)',
        }}
      >
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: '8px',
                background: 'rgba(99, 102, 241, 0.2)',
                border: '1px solid rgba(99, 102, 241, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--brand-primary-light)',
              }}
            >
              <IconSparkles size={18} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>Project Intelligence Executive Summary</h3>
                <Badge variant={aiAssistant.isConfigured ? 'brand' : 'neutral'}>
                  {aiAssistant.isConfigured ? `${aiAssistant.provider || 'AI'} Grounded` : 'AI Not Configured'}
                </Badge>
              </div>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Real-time synthesis of artifacts, git diffs, impacts, reviews, and tasks.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {aiSummary && (
              <Button variant="outline" size="sm" icon={<IconCopy size={14} />} onClick={handleCopySummary}>
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            )}
            <Button
              variant="primary"
              size="sm"
              icon={<IconSparkles size={14} />}
              isLoading={isGeneratingAi}
              onClick={handleGenerateSummary}
            >
              {aiSummary ? 'Refresh AI Summary' : 'Generate AI Summary'}
            </Button>
          </div>
        </div>

        <div style={{ padding: '1.25rem 1.5rem' }}>
          {isGeneratingAi ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              Analyzing accessible artifacts, native Git commits, relationship links, and pending reviews...
            </div>
          ) : aiError ? (
            <div style={{ padding: '1rem', background: 'var(--status-danger-bg)', color: 'var(--status-danger)', borderRadius: 'var(--radius-md)', fontSize: '0.86rem' }}>
              {aiError}
            </div>
          ) : aiSummary ? (
            <div>
              <div
                style={{
                  fontSize: '0.9rem',
                  lineHeight: 1.6,
                  color: 'var(--text-primary)',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {aiSummary}
              </div>

              {aiSources.length > 0 && (
                <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                    Verified Project Grounding Evidence:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                    {aiSources.map((src, idx) => (
                      <span
                        key={idx}
                        style={{
                          fontSize: '0.75rem',
                          padding: '0.2rem 0.5rem',
                          background: 'rgba(99, 102, 241, 0.1)',
                          border: '1px solid rgba(99, 102, 241, 0.25)',
                          borderRadius: '4px',
                          color: 'var(--brand-primary-light)',
                        }}
                      >
                        {src.type}: {src.title || src.identifier}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div
              style={{
                padding: '1.5rem',
                textAlign: 'center',
                borderRadius: '8px',
                border: '1px dashed var(--border-subtle)',
                color: 'var(--text-secondary)',
                fontSize: '0.88rem',
              }}
            >
              Click <strong>"Generate AI Summary"</strong> to produce an evidence-grounded briefing of current project health, active working tree changes, and unaddressed reviews.
            </div>
          )}
        </div>
      </div>

      {/* 4. WORKFLOW GRID: PENDING REVIEWS + TASKS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem' }}>
        {/* PENDING REVIEWS CARD */}
        <div className="card">
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <IconReviews size={18} style={{ color: 'var(--brand-primary-light)' }} />
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>Pending Review Requests</h4>
              <Badge variant="brand">{pendingReviews.length}</Badge>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onNavigateTab('reviews')}>
              View All <IconArrowRight size={14} />
            </Button>
          </div>

          <div style={{ padding: '1rem 1.25rem' }}>
            {pendingReviews.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1.5rem 0', color: 'var(--text-muted)', fontSize: '0.86rem' }}>
                No reviews pending approval. All changes up to date!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {pendingReviews.map((rev) => (
                  <div
                    key={rev.id}
                    style={{
                      padding: '0.75rem 1rem',
                      borderRadius: 'var(--radius-md)',
                      background: rev.isAwaitingUser ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-secondary)',
                      border: rev.isAwaitingUser ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid var(--border-subtle)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.35rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                        {rev.title}
                      </span>
                      {rev.isAwaitingUser ? (
                        <Badge variant="warning">Awaiting You</Badge>
                      ) : (
                        <Badge variant="neutral">{rev.status.toUpperCase()}</Badge>
                      )}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      Target: <code>{rev.targetRef}</code> ({rev.targetType}) • Approvals: {rev.approvalsCount} / {rev.reviewersCount}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* MY TASKS & OVERDUE CARD */}
        <div className="card">
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <IconTasks size={18} style={{ color: 'var(--brand-primary-light)' }} />
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>Active Tasks & Action Items</h4>
              <Badge variant="brand">{myTasks.length}</Badge>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onNavigateTab('tasks')}>
              View All <IconArrowRight size={14} />
            </Button>
          </div>

          <div style={{ padding: '1rem 1.25rem' }}>
            {myTasks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1.5rem 0', color: 'var(--text-muted)', fontSize: '0.86rem' }}>
                No active tasks assigned.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {myTasks.map((t) => (
                  <div
                    key={t.id}
                    style={{
                      padding: '0.75rem 1rem',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--bg-secondary)',
                      border: t.isOverdue ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid var(--border-subtle)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.35rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                        {t.title}
                      </span>
                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        {t.isOverdue && <Badge variant="danger">Overdue</Badge>}
                        <Badge variant={t.priority === 'urgent' ? 'danger' : t.priority === 'high' ? 'warning' : 'neutral'}>
                          {t.priority.toUpperCase()}
                        </Badge>
                      </div>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      Status: {t.status.replace('_', ' ')} {t.dueDate && `• Due: ${new Date(t.dueDate).toLocaleDateString()}`}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 5. GIT & GITHUB SYNCHRONIZATION STATUS */}
      <div className="card">
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <IconGitCommit size={18} style={{ color: 'var(--brand-primary-light)' }} />
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>Native Version Control & GitHub Sync</h4>
            <Badge variant={git.isInitialized ? 'success' : 'neutral'}>
              {git.isInitialized ? (git.currentBranch ? `Branch: ${git.currentBranch}` : 'Git Active') : 'Uninitialized'}
            </Badge>
          </div>
          <Button variant="ghost" size="sm" onClick={() => onNavigateTab('history')}>
            Full History <IconArrowRight size={14} />
          </Button>
        </div>

        <div style={{ padding: '1.25rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
          {/* Recent Commits */}
          <div>
            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.6rem', textTransform: 'uppercase' }}>
              Recent Commits
            </div>
            {git.recentCommits.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No commits yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {git.recentCommits.map((c) => (
                  <div key={c.hash} style={{ fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <code style={{ color: 'var(--brand-primary-light)', fontSize: '0.78rem' }}>{c.shortHash}</code>
                    <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-primary)' }}>
                      {c.message}
                    </span>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                      {new Date(c.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* GitHub Remote Info */}
          <div>
            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.6rem', textTransform: 'uppercase' }}>
              GitHub Remote Status
            </div>
            {github.isLinked ? (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <div>
                  Repository: <strong>{github.owner}/{github.repo}</strong>
                </div>
                <div>
                  Sync: {github.aheadBy || 0} ahead, {github.behindBy || 0} behind remote
                </div>
                {github.lastSyncAt && (
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Last sync: {new Date(github.lastSyncAt).toLocaleString()}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No remote GitHub repository linked. Local Git engine is managing version tracking.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
