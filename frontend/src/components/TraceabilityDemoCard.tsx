import React from 'react';

export const TraceabilityDemoCard: React.FC = () => {
  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">
          <span>🧠</span>
          <span>Core Differentiator: Impact & Traceability Concept</span>
        </div>
        <span className="badge badge-brand">Planned for Phase 10</span>
      </div>

      <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
        Conventional tools only record file differences. Versora understands the <strong>semantic dependency graph</strong> across code, data, models, and documentation to answer: <em>"When this changes, what does it affect?"</em>
      </p>

      {/* Conceptual Visual Pipeline */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          padding: '1.25rem',
          background: 'rgba(0, 0, 0, 0.25)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <span className="badge badge-danger">1. Trigger</span>
          <span className="font-mono" style={{ color: 'var(--text-primary)', fontSize: '0.9rem', fontWeight: 600 }}>
            scripts/train.py
          </span>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            (Modified: learning_rate updated)
          </span>
        </div>

        <div style={{ paddingLeft: '1.25rem', color: 'var(--brand-primary-light)', fontSize: '1rem' }}>
          ↓ <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>[DERIVED_FROM]</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <span className="badge badge-warning">2. Direct Dependency</span>
          <span className="font-mono" style={{ color: 'var(--text-primary)', fontSize: '0.9rem', fontWeight: 600 }}>
            models/weights_checkpoint.onnx
          </span>
          <span style={{ fontSize: '0.82rem', color: 'var(--status-warning)' }}>
            (Needs Re-generation)
          </span>
        </div>

        <div style={{ paddingLeft: '1.25rem', color: 'var(--brand-primary-light)', fontSize: '1rem' }}>
          ↓ <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>[VALIDATES]</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <span className="badge badge-warning">3. Upstream Metric</span>
          <span className="font-mono" style={{ color: 'var(--text-primary)', fontSize: '0.9rem', fontWeight: 600 }}>
            results/benchmark_table.json
          </span>
          <span style={{ fontSize: '0.82rem', color: 'var(--status-warning)' }}>
            (Potentially Stale)
          </span>
        </div>

        <div style={{ paddingLeft: '1.25rem', color: 'var(--brand-primary-light)', fontSize: '1rem' }}>
          ↓ <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>[DOCUMENTS]</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <span className="badge badge-info">4. Downstream Document</span>
          <span className="font-mono" style={{ color: 'var(--text-primary)', fontSize: '0.9rem', fontWeight: 600 }}>
            docs/paper_submission.md (Section 3.2)
          </span>
          <span style={{ fontSize: '0.82rem', color: 'var(--brand-trace-light)' }}>
            (Review Flagged: Update Accuracy Metric)
          </span>
        </div>
      </div>
    </div>
  );
};
