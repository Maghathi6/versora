import React from 'react';
import { BrandLogo } from './BrandLogo';
import { ViewMode } from '../types/api';

interface HeaderProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  isBackendConnected: boolean;
  isLoadingBackend: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  viewMode,
  onViewModeChange,
  isBackendConnected,
  isLoadingBackend,
}) => {
  return (
    <header className="navbar">
      <div className="navbar-brand">
        <BrandLogo size={32} />
      </div>

      <div className="navbar-actions">
        {/* Backend Live Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginRight: '0.5rem' }}>
          <span
            className={`health-dot ${
              isLoadingBackend ? '' : isBackendConnected ? 'healthy' : 'error'
            }`}
          />
          <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            {isLoadingBackend
              ? 'Checking API...'
              : isBackendConnected
              ? 'API Connected'
              : 'API Offline'}
          </span>
        </div>

        {/* Beginner vs Advanced Mode Switcher */}
        <div className="mode-switch-group" role="group" aria-label="Interface Mode">
          <button
            type="button"
            className={`mode-btn ${viewMode === 'beginner' ? 'active' : ''}`}
            onClick={() => onViewModeChange('beginner')}
            title="Simplified terminology without Git jargon"
          >
            🌱 Beginner Mode
          </button>
          <button
            type="button"
            className={`mode-btn ${viewMode === 'advanced' ? 'active' : ''}`}
            onClick={() => onViewModeChange('advanced')}
            title="Explicit Git concepts and technical diagnostics"
          >
            ⚡ Advanced Mode
          </button>
        </div>
      </div>
    </header>
  );
};
