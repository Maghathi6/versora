import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { workflowService } from '../../services/workflowService';
import { assistantService } from '../../services/assistantService';
import { GitFileChange } from '../../types/git';
import { WorkflowContextResponse } from '../../types/workflow';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import {
  IconSparkles,
  IconReviews,
  IconTasks,
  IconCheck,
  IconFileText,
} from '../common/Icons';

interface ChangeWorkflowPanelProps {
  projectId: string;
  changes: GitFileChange[];
  selectedFile?: string | null;
  onSelectFile?: (filePath: string) => void;
  onCreateReview?: (targetRef: string, suggestedTitle: string) => void;
  onCreateTask?: (linkedArtifactPath: string, taskTitle: string) => void;
}

export const ChangeWorkflowPanel: React.FC<ChangeWorkflowPanelProps> = ({
  projectId,
  changes,
  selectedFile,
  onSelectFile,
  onCreateReview,
  onCreateTask,
}) => {
  const [activeFile, setActiveFile] = useState<string>(selectedFile || (changes[0]?.path || ''));
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [isExplaining, setIsExplaining] = useState<boolean>(false);

  useQuery<WorkflowContextResponse>({
    queryKey: ['workflow-context', projectId, activeFile],
    queryFn: () => workflowService.getWorkflowContext(projectId, { artifactId: undefined }),
    enabled: Boolean(activeFile),
  });

  const handleExplainChange = async () => {
    setIsExplaining(true);
    setAiExplanation(null);
    try {
      const res = await assistantService.executeQuickAction(projectId, {
        action: 'explain-artifact',
        targetId: activeFile,
      });
      setAiExplanation(res.content);
    } catch (err: any) {
      setAiExplanation(err.message || 'Failed to explain changes with AI.');
    } finally {
      setIsExplaining(false);
    }
  };

  if (changes.length === 0) {
    return (
      <div
        className="card"
        style={{
          padding: '2rem',
          textAlign: 'center',
          color: 'var(--text-secondary)',
          border: '1px dashed var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.75rem' }}>
          <IconCheck size={28} style={{ color: 'var(--status-success)' }} />
        </div>
        <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>Working tree is completely clean</h4>
        <p style={{ margin: 0, fontSize: '0.85rem' }}>
          No modified, staged, or untracked files detected in this workspace.
        </p>
      </div>
    );
  }

  const modifiedArtifactsCount = changes.length;

  return (
    <div
      className="card"
      style={{
        border: '1px solid rgba(99, 102, 241, 0.35)',
        background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.9) 100%)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        marginBottom: '1.5rem',
      }}
    >
      {/* Header */}
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
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>Change-to-Review Workflow</h3>
              <Badge variant="brand">{modifiedArtifactsCount} Changed Files</Badge>
            </div>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Trace modified code into impact analysis, downstream dependencies, and peer reviews.
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {onCreateReview && (
            <Button
              variant="primary"
              size="sm"
              icon={<IconReviews size={14} />}
              onClick={() => onCreateReview(activeFile, `Review changes on ${activeFile || 'branch'}`)}
            >
              Initiate Review Request
            </Button>
          )}
          {onCreateTask && (
            <Button
              variant="outline"
              size="sm"
              icon={<IconTasks size={14} />}
              onClick={() => onCreateTask(activeFile, `Verify downstream changes for ${activeFile}`)}
            >
              Add Verification Task
            </Button>
          )}
        </div>
      </div>

      {/* Body: File Selector + Downstream Impact + AI Explanation */}
      <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Changed Files Selector Chips */}
        <div>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
            Select Modified File to Analyze:
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {changes.map((c) => {
              const isSelected = activeFile === c.path;
              return (
                <button
                  key={c.path}
                  onClick={() => {
                    setActiveFile(c.path);
                    if (onSelectFile) onSelectFile(c.path);
                  }}
                  style={{
                    padding: '0.35rem 0.65rem',
                    borderRadius: '6px',
                    border: isSelected ? '1px solid var(--brand-primary)' : '1px solid var(--border-subtle)',
                    background: isSelected ? 'rgba(99, 102, 241, 0.2)' : 'var(--bg-secondary)',
                    color: isSelected ? 'var(--brand-primary-light)' : 'var(--text-primary)',
                    fontSize: '0.82rem',
                    fontWeight: isSelected ? 700 : 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                  }}
                >
                  <IconFileText size={13} />
                  <span>{c.path}</span>
                  <Badge variant={c.status === 'modified' ? 'brand' : 'success'}>{c.status}</Badge>
                </button>
              );
            })}
          </div>
        </div>

        {/* Downstream Impact Alert & Quick Action */}
        <div
          style={{
            padding: '1rem',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <IconSparkles size={16} style={{ color: 'var(--brand-primary-light)' }} />
              <strong style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                Downstream Traceability & Review Advice
              </strong>
            </div>
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              Get automated advice on what tests to run, which stakeholders to notify, and potential breaking changes.
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            icon={<IconSparkles size={14} />}
            isLoading={isExplaining}
            onClick={handleExplainChange}
          >
            Explain Diff with AI
          </Button>
        </div>

        {/* AI Diff Explanation Callout */}
        {aiExplanation && (
          <div
            style={{
              padding: '1.25rem',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(99, 102, 241, 0.08)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              fontSize: '0.88rem',
              lineHeight: 1.6,
              color: 'var(--text-primary)',
              whiteSpace: 'pre-wrap',
            }}
          >
            <div style={{ fontWeight: 700, color: 'var(--brand-primary-light)', marginBottom: '0.5rem' }}>
              🤖 AI Code & Impact Explanation:
            </div>
            {aiExplanation}
          </div>
        )}
      </div>
    </div>
  );
};
