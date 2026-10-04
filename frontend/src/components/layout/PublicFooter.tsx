import React from 'react';
import { Link } from 'react-router-dom';
import { BrandLogo } from '../BrandLogo';

export const PublicFooter: React.FC = () => {
  return (
    <footer className="public-footer">
      <div className="public-footer-container">
        <div className="footer-brand-col">
          <BrandLogo size={28} />
          <p className="footer-tagline">
            Track what changed. Understand what it affects.
          </p>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            A modern, user-friendly version-control and project traceability platform.
          </p>
        </div>

        <div className="footer-links-group">
          <div className="footer-links-col">
            <span className="footer-col-title">Platform</span>
            <Link to="/dashboard" className="footer-link">Overview</Link>
            <Link to="/projects" className="footer-link">Projects</Link>
            <Link to="/reviews" className="footer-link">Change Requests</Link>
          </div>

          <div className="footer-links-col">
            <span className="footer-col-title">Account</span>
            <Link to="/login" className="footer-link">Sign In</Link>
            <Link to="/signup" className="footer-link">Get Started</Link>
            <Link to="/settings" className="footer-link">Preferences</Link>
          </div>

          <div className="footer-links-col">
            <span className="footer-col-title">Architecture</span>
            <a href="https://github.com/Maghathi6/versora" target="_blank" rel="noopener noreferrer" className="footer-link">
              GitHub Repo
            </a>
            <span className="footer-link" style={{ color: 'var(--text-muted)' }}>Phase 1 Foundation</span>
            <span className="footer-link" style={{ color: 'var(--text-muted)' }}>Tri-Store Model</span>
          </div>
        </div>
      </div>

      <div className="footer-bottom-bar">
        <span>&copy; {new Date().getFullYear()} Versora. Built for modular, traceable software delivery.</span>
        <span>Version Control &bull; Impact Intelligence &bull; Artifact Graphs</span>
      </div>
    </footer>
  );
};
