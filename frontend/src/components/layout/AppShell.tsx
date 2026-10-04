import React, { useState } from 'react';
import { NavLink, Outlet, Link, useLocation } from 'react-router-dom';
import { BrandLogo } from '../BrandLogo';
import { ModeToggle } from '../common/ModeToggle';
import {
  IconDashboard,
  IconProjects,
  IconActivity,
  IconReviews,
  IconNotifications,
  IconSettings,
  IconMenu,
  IconClose,
} from '../common/Icons';
import { useTerminology } from '../../context/TerminologyContext';
import { useQuery } from '@tanstack/react-query';
import { healthService } from '../../services/apiClient';

export const AppShell: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { t } = useTerminology();
  const location = useLocation();

  // Real backend health check for the shell status dot
  const { data: healthResult, isLoading: isCheckingHealth } = useQuery({
    queryKey: ['shellHealth'],
    queryFn: () => healthService.getHealth(),
    refetchInterval: 15000,
  });

  const isBackendHealthy = healthResult?.data?.status === 'healthy';

  const navItems = [
    { to: '/dashboard', label: 'Overview', icon: <IconDashboard size={18} /> },
    { to: '/projects', label: t('projects'), icon: <IconProjects size={18} /> },
    { to: '/activity', label: 'Activity', icon: <IconActivity size={18} /> },
    { to: '/reviews', label: t('reviews'), icon: <IconReviews size={18} /> },
    { to: '/notifications', label: 'Notifications', icon: <IconNotifications size={18} /> },
    { to: '/settings', label: 'Settings', icon: <IconSettings size={18} /> },
  ];

  const getPageTitle = () => {
    switch (location.pathname) {
      case '/dashboard': return 'Overview';
      case '/projects': return t('projects');
      case '/activity': return 'Project Activity';
      case '/reviews': return t('reviews');
      case '/notifications': return 'Notifications';
      case '/settings': return 'Settings';
      default: return 'Versora';
    }
  };

  return (
    <div className="shell-container">
      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div
          className="shell-backdrop"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Navigation */}
      <aside className={`shell-sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}>
        <div className="shell-sidebar-header">
          <Link to="/" style={{ display: 'inline-flex', alignItems: 'center' }}>
            <BrandLogo size={28} />
          </Link>
          <button
            type="button"
            className="mobile-close-btn"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close navigation menu"
          >
            <IconClose size={20} />
          </button>
        </div>

        <nav className="shell-nav">
          <div className="nav-section-label">WORKSPACE</div>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `shell-nav-link ${isActive ? 'active' : ''}`
              }
              onClick={() => setMobileMenuOpen(false)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="shell-sidebar-footer">
          <div className="user-profile-badge">
            <div className="user-avatar">
              <span>G</span>
            </div>
            <div className="user-info">
              <span className="user-name">Guest User</span>
              <span className="user-status">Phase 2: Auth</span>
            </div>
          </div>
          <div style={{ marginTop: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Link to="/" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              &larr; Landing Page
            </Link>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>v0.1.0</span>
          </div>
        </div>
      </aside>

      {/* Main Workspace Area */}
      <div className="shell-main">
        {/* Top Header Bar */}
        <header className="shell-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button
              type="button"
              className="mobile-menu-btn"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
            >
              <IconMenu size={22} />
            </button>
            <div className="shell-breadcrumbs">
              <span style={{ color: 'var(--text-muted)' }}>App</span>
              <span style={{ color: 'var(--border-strong)' }}>/</span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{getPageTitle()}</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {/* Real API Status Indicator */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.3rem 0.75rem',
                borderRadius: 'var(--radius-full)',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--border-subtle)',
                fontSize: '0.8rem',
              }}
              title="Real-time connectivity to Versora Express API"
            >
              <span
                className={`health-dot ${
                  isCheckingHealth ? '' : isBackendHealthy ? 'healthy' : 'error'
                }`}
                style={{ width: 7, height: 7 }}
              />
              <span style={{ color: 'var(--text-secondary)' }}>
                {isCheckingHealth ? 'Checking API...' : isBackendHealthy ? 'API Active' : 'API Offline'}
              </span>
            </div>

            {/* Beginner / Advanced Terminology Toggle */}
            <ModeToggle />
          </div>
        </header>

        {/* Dynamic Page Outlet */}
        <main className="shell-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
