import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BrandLogo } from '../BrandLogo';
import { ModeToggle } from '../common/ModeToggle';
import { IconMenu, IconClose } from '../common/Icons';
import { useQuery } from '@tanstack/react-query';
import { healthService } from '../../services/apiClient';

export const PublicNavbar: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const { data: healthResult } = useQuery({
    queryKey: ['publicHealthCheck'],
    queryFn: () => healthService.getHealth(),
    refetchInterval: 20000,
  });

  const isHealthy = healthResult?.data?.status === 'healthy';

  return (
    <nav className="public-navbar">
      <div className="public-nav-container">
        <Link to="/" style={{ display: 'inline-flex', alignItems: 'center' }}>
          <BrandLogo size={32} />
        </Link>

        {/* Desktop Links */}
        <div className="public-nav-links">
          <Link to="/" className={`public-nav-link ${location.pathname === '/' ? 'active' : ''}`}>
            Product
          </Link>
          <Link to="/dashboard" className="public-nav-link">
            Dashboard
          </Link>
          <a
            href="https://github.com/Maghathi6/versora"
            target="_blank"
            rel="noopener noreferrer"
            className="public-nav-link"
          >
            GitHub
          </a>
        </div>

        {/* Actions & Mode Switcher */}
        <div className="public-nav-actions">
          {/* Status Dot */}
          <div
            style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.78rem' }}
            title="Real-time backend API status"
          >
            <span
              className={`health-dot ${isHealthy ? 'healthy' : 'error'}`}
              style={{ width: 6, height: 6 }}
            />
            <span style={{ color: 'var(--text-muted)' }}>
              {isHealthy ? 'API Online' : 'API Standby'}
            </span>
          </div>

          <ModeToggle compact />

          <Link to="/login" className="btn btn-outline" style={{ fontSize: '0.82rem', padding: '0.35rem 0.85rem' }}>
            Sign In
          </Link>
          <Link to="/signup" className="btn btn-primary" style={{ fontSize: '0.82rem', padding: '0.35rem 0.95rem' }}>
            Get Started
          </Link>
        </div>

        {/* Mobile Hamburger Button */}
        <button
          type="button"
          className="mobile-hamburger"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle navigation menu"
        >
          {mobileMenuOpen ? <IconClose size={22} /> : <IconMenu size={22} />}
        </button>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="public-mobile-dropdown">
          <Link
            to="/"
            className="public-mobile-link"
            onClick={() => setMobileMenuOpen(false)}
          >
            Product
          </Link>
          <Link
            to="/dashboard"
            className="public-mobile-link"
            onClick={() => setMobileMenuOpen(false)}
          >
            Dashboard
          </Link>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)' }}>
            <Link
              to="/login"
              className="btn btn-outline"
              style={{ flex: 1, textAlign: 'center', fontSize: '0.85rem' }}
              onClick={() => setMobileMenuOpen(false)}
            >
              Sign In
            </Link>
            <Link
              to="/signup"
              className="btn btn-primary"
              style={{ flex: 1, textAlign: 'center', fontSize: '0.85rem' }}
              onClick={() => setMobileMenuOpen(false)}
            >
              Get Started
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
};
