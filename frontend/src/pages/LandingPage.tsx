import React from 'react';
import { Link } from 'react-router-dom';
import { PublicNavbar } from '../components/layout/PublicNavbar';
import { PublicFooter } from '../components/layout/PublicFooter';
import { TerminologyPreview } from '../components/TerminologyPreview';
import { TraceabilityDemoCard } from '../components/TraceabilityDemoCard';
import { useTerminology } from '../context/TerminologyContext';
import { IconArrowRight, IconShield, IconLayers, IconSparkles } from '../components/common/Icons';

export const LandingPage: React.FC = () => {
  const { mode } = useTerminology();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <PublicNavbar />

      <main style={{ flex: 1 }}>
        {/* Hero Section */}
        <section className="landing-hero">
          <div className="landing-hero-container">
            <div className="hero-pill">
              <IconSparkles size={15} />
              <span>Next-Gen Version Control & Traceability</span>
            </div>

            <h1 className="hero-title" style={{ fontSize: '3.25rem', maxWidth: '880px', margin: '0 auto 1.25rem' }}>
              Track what changed.<br />
              <span style={{ color: 'var(--brand-trace-light)' }}>Understand what it affects.</span>
            </h1>

            <p className="hero-tagline" style={{ maxWidth: '680px', margin: '0 auto 2.25rem', fontSize: '1.25rem' }}>
              Versora combines intuitive, human-centered version control powered by <strong>real Git</strong> with cross-artifact traceability to predict the ripple effects of every change before it impacts your project.
            </p>

            <div className="hero-cta-group">
              <Link to="/signup" className="btn btn-primary" style={{ padding: '0.8rem 1.8rem', fontSize: '1rem' }}>
                <span>Get Started</span>
                <IconArrowRight size={18} />
              </Link>
              <Link to="/dashboard" className="btn btn-outline" style={{ padding: '0.8rem 1.6rem', fontSize: '1rem' }}>
                <span>Explore Platform</span>
              </Link>
            </div>
          </div>
        </section>

        {/* Two Core Pillars Section */}
        <section className="landing-section">
          <div className="landing-container">
            <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
              <span className="badge badge-brand" style={{ marginBottom: '0.75rem' }}>CORE PILLARS</span>
              <h2 style={{ fontSize: '2.2rem', fontWeight: 800 }}>The Two Foundations of Versora</h2>
              <p style={{ color: 'var(--text-secondary)', maxWidth: '600px', margin: '0.5rem auto 0' }}>
                Bridging the gap between accessible collaboration and true version integrity.
              </p>
            </div>

            <div className="pillars-grid">
              {/* Pillar 1 */}
              <div className="pillar-card">
                <div className="pillar-icon-box">
                  <IconShield size={26} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <span className="badge badge-success">Pillar 1</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Backed by Real Git</span>
                </div>
                <h3 style={{ fontSize: '1.35rem', marginBottom: '0.75rem' }}>
                  Simple Version Control
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: 1.6, marginBottom: '1.25rem' }}>
                  Git commands and esoteric terminal terminology intimidate non-engineers. Versora replaces confusing jargon with plain, human concepts—<strong>Save Changes</strong>, <strong>Workspaces</strong>, and <strong>Change Requests</strong>—while executing authentic Git operations under the hood.
                </p>
                <ul className="pillar-checklist">
                  <li>No terminal intimidation or command memorization</li>
                  <li>Instant toggle to Advanced Mode for raw Git commits & SHAs</li>
                  <li>Real Git repositories, branches, and diffs on disk</li>
                </ul>
              </div>

              {/* Pillar 2 */}
              <div className="pillar-card highlight-border">
                <div className="pillar-icon-box cyan">
                  <IconLayers size={26} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <span className="badge badge-info">Pillar 2</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--brand-trace-light)' }}>Core Differentiator</span>
                </div>
                <h3 style={{ fontSize: '1.35rem', marginBottom: '0.75rem' }}>
                  Project Traceability & Impact Intelligence
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: 1.6, marginBottom: '1.25rem' }}>
                  Source code does not live in isolation. When a machine learning script or data preprocessing pipeline changes, Versora traverses the artifact dependency graph to automatically identify downstream reports, datasets, and presentations requiring review.
                </p>
                <ul className="pillar-checklist">
                  <li>Directed dependency tracking between code, data, & docs</li>
                  <li>Automated downstream stale artifact flagging</li>
                  <li>Visual impact paths embedded directly in change reviews</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Interactive Feature Demonstrations */}
        <section className="landing-section" style={{ background: 'rgba(255, 255, 255, 0.01)', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="landing-container">
            <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
              <span className="badge badge-brand" style={{ marginBottom: '0.75rem' }}>EXPERIENCE THE DIFFERENCE</span>
              <h2 style={{ fontSize: '2.1rem', fontWeight: 800 }}>See How Versora Works</h2>
              <p style={{ color: 'var(--text-secondary)', maxWidth: '620px', margin: '0.5rem auto 0' }}>
                Toggle between Beginner and Advanced modes in real time, and explore how changes ripple through connected assets.
              </p>
            </div>

            <div className="dashboard-grid">
              <div className="col-span-6">
                <TerminologyPreview viewMode={mode} />
              </div>
              <div className="col-span-6">
                <TraceabilityDemoCard />
              </div>
            </div>
          </div>
        </section>

        {/* CTA Banner Section */}
        <section className="landing-section" style={{ textAlign: 'center', padding: '5rem 1.5rem' }}>
          <div style={{ maxWidth: '640px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '2.4rem', fontWeight: 800, marginBottom: '1rem' }}>
              Ready to take control of your project's lifecycle?
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', marginBottom: '2rem' }}>
              Build with confidence. Know what your changes impact before merging.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <Link to="/signup" className="btn btn-primary" style={{ padding: '0.75rem 1.75rem', fontSize: '0.95rem' }}>
                Get Started with Versora
              </Link>
              <Link to="/dashboard" className="btn btn-outline" style={{ padding: '0.75rem 1.5rem', fontSize: '0.95rem' }}>
                View Dashboard
              </Link>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
};
