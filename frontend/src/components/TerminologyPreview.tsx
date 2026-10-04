import React from 'react';
import { ViewMode } from '../types/api';

interface TerminologyPreviewProps {
  viewMode: ViewMode;
}

interface TermPair {
  beginner: string;
  git: string;
  intention: string;
}

const TERMINOLOGY_DATA: TermPair[] = [
  { beginner: 'Project', git: 'Repository', intention: 'The central home for all files, data, and versions' },
  { beginner: 'Workspace', git: 'Branch', intention: 'An isolated environment to experiment without affecting main files' },
  { beginner: 'Save Changes', git: 'Commit', intention: 'Record a milestone checkpoint of modifications with a note' },
  { beginner: 'Switch Workspace', git: 'Checkout', intention: 'Seamlessly jump between parallel lines of exploration' },
  { beginner: 'Get Latest', git: 'Pull / Fetch', intention: 'Download updates made by colleagues' },
  { beginner: 'Send Changes', git: 'Push', intention: 'Publish your saved checkpoints to the team server' },
  { beginner: 'Change Request', git: 'Pull Request', intention: 'Propose combining workspace changes and request peer review' },
  { beginner: 'Combine Changes', git: 'Merge', intention: 'Integrate verified changes from one workspace into another' },
  { beginner: 'Project Version', git: 'Tag / Release', intention: 'Freeze a milestone release snapshot (e.g. Paper Submission)' },
];

export const TerminologyPreview: React.FC<TerminologyPreviewProps> = ({ viewMode }) => {
  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">
          <span>📖</span>
          <span>Dual-Mode Terminology Engine</span>
        </div>
        <span className="badge badge-brand">
          Active: {viewMode === 'beginner' ? 'Beginner Mode' : 'Advanced Mode'}
        </span>
      </div>

      <p style={{ fontSize: '0.88rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
        Versora keeps <strong>authentic Git</strong> as the underlying engine while providing human-friendly terminology. Advanced users can view raw Git structures at any time.
      </p>

      <div style={{ overflowX: 'auto' }}>
        <table className="term-table">
          <thead>
            <tr>
              <th style={{ width: '30%' }}>Versora Term (Beginner)</th>
              <th style={{ width: '25%' }}>Git Technical Term (Advanced)</th>
              <th style={{ width: '45%' }}>Core Human Intention</th>
            </tr>
          </thead>
          <tbody>
            {TERMINOLOGY_DATA.map((item, idx) => (
              <tr key={idx}>
                <td
                  className="term-beginner"
                  style={{
                    backgroundColor: viewMode === 'beginner' ? 'rgba(6, 182, 212, 0.08)' : 'transparent',
                    fontWeight: viewMode === 'beginner' ? 700 : 500,
                  }}
                >
                  {item.beginner}
                </td>
                <td
                  className="term-git"
                  style={{
                    backgroundColor: viewMode === 'advanced' ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
                    fontWeight: viewMode === 'advanced' ? 700 : 400,
                  }}
                >
                  {item.git}
                </td>
                <td style={{ color: 'var(--text-secondary)', fontSize: '0.84rem' }}>
                  {item.intention}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
