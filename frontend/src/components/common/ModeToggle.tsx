import React from 'react';
import { useTerminology } from '../../context/TerminologyContext';

interface ModeToggleProps {
  compact?: boolean;
}

export const ModeToggle: React.FC<ModeToggleProps> = ({ compact = false }) => {
  const { mode, setMode } = useTerminology();

  if (compact) {
    return (
      <button
        type="button"
        className="btn btn-outline"
        onClick={() => setMode(mode === 'beginner' ? 'advanced' : 'beginner')}
        title={`Current mode: ${mode === 'beginner' ? 'Beginner' : 'Advanced'}. Click to toggle.`}
        style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
      >
        {mode === 'beginner' ? '🌱 Beginner' : '⚡ Advanced'}
      </button>
    );
  }

  return (
    <div className="mode-switch-group" role="group" aria-label="Terminology Mode">
      <button
        type="button"
        className={`mode-btn ${mode === 'beginner' ? 'active' : ''}`}
        onClick={() => setMode('beginner')}
        title="Friendly terminology without Git jargon"
      >
        🌱 Beginner
      </button>
      <button
        type="button"
        className={`mode-btn ${mode === 'advanced' ? 'active' : ''}`}
        onClick={() => setMode('advanced')}
        title="Raw Git concepts and technical precision"
      >
        ⚡ Advanced
      </button>
    </div>
  );
};
