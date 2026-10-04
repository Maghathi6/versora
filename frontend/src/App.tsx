import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Header } from './components/Header';
import { HealthCard } from './components/HealthCard';
import { TerminologyPreview } from './components/TerminologyPreview';
import { ArchitectureCard } from './components/ArchitectureCard';
import { TraceabilityDemoCard } from './components/TraceabilityDemoCard';
import { ViewMode, ApiSuccessResponse, HealthCheckData } from './types/api';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export const App: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('beginner');

  // Lightweight status check for header
  const { data: healthData, isLoading: isLoadingHealth } = useQuery<boolean>({
    queryKey: ['headerHealthCheck'],
    queryFn: async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/health`);
        if (!res.ok) return false;
        const data: ApiSuccessResponse<HealthCheckData> = await res.json();
        return data.success && data.data.status === 'healthy';
      } catch {
        return false;
      }
    },
    refetchInterval: 10000,
  });

  const isConnected = !!healthData;

  return (
    <div className="app-container">
      {/* Navigation Header */}
      <Header
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        isBackendConnected={isConnected}
        isLoadingBackend={isLoadingHealth}
      />

      {/* Main Content Area */}
      <main className="main-content">
        {/* Hero Section */}
        <section className="hero-section">
          <div className="hero-pill">
            <span>✨</span> Phase 0: System Architecture & Foundation
          </div>
          <h1 className="hero-title">Track what changed. Understand what it affects.</h1>
          <p className="hero-tagline">
            Versora combines <strong>simple, accessible version control</strong> powered by real Git with{' '}
            <strong>cross-artifact traceability</strong> to predict and visualize the ripple effects of every change.
          </p>
        </section>

        {/* Dashboard Grid */}
        <div className="dashboard-grid">
          {/* Left Column: Health and Terminology */}
          <div className="col-span-6" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <HealthCard />
            <TerminologyPreview viewMode={viewMode} />
          </div>

          {/* Right Column: Architecture & Impact Concept */}
          <div className="col-span-6" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <ArchitectureCard />
            <TraceabilityDemoCard />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="footer">
        <p>
          <strong>VERSORA</strong> &bull; Phase 0 Foundation &bull; Node.js + Express + TypeScript &bull; React + Vite
        </p>
        <p style={{ marginTop: '0.4rem', fontSize: '0.78rem' }}>
          Git engine integration, PostgreSQL, and Artifact Impact Analysis will be introduced in subsequent roadmap phases.
        </p>
      </footer>
    </div>
  );
};

export default App;
