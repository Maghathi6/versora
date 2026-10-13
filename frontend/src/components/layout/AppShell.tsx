import React, { useState } from 'react';
import { NavLink, Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
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
import { useAuth } from '../../context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { healthService } from '../../services/apiClient';

import { NotificationBell } from '../collaboration/NotificationBell';
import { collaborationService } from '../../services/collaborationService';

export const AppShell: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { t } = useTerminology();
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getInitials = (name?: string, fallback = 'U'): string => {
    if (!name) return fallback;
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  // Real backend health check for the shell status dot
  const { data: healthResult, isLoading: isCheckingHealth } = useQuery({
    queryKey: ['shellHealth'],
    queryFn: () => healthService.getHealth(),
    refetchInterval: 15000,
  });

  const isBackendHealthy = healthResult?.data?.status === 'healthy';

  // Real unread notification count
  const { data: unreadNotificationsData } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => collaborationService.getUnreadNotificationCount(),
    refetchInterval: 30000,
    enabled: !!user,
  });
  const unreadCount = unreadNotificationsData ?? 0;

  const navItems = [
    { to: '/dashboard', label: 'Overview', icon: <IconDashboard size={18} /> },
    { to: '/projects', label: t('projects'), icon: <IconProjects size={18} /> },
    { to: '/activity', label: 'Activity', icon: <IconActivity size={18} /> },
    { to: '/reviews', label: t('reviews'), icon: <IconReviews size={18} /> },
    { to: '/notifications', label: 'Notifications', icon: <IconNotifications size={18} />, badge: unreadCount > 0 ? unreadCount : undefined },
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
              {item.badge !== undefined && (
                <span
                  style={{
                    marginLeft: 'auto',
                    background: 'var(--brand-primary)',
                    color: '#fff',
                    borderRadius: '10px',
                    padding: '0.1rem 0.45rem',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                  }}
                >
                  {item.badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="shell-sidebar-footer">
          <div className="user-profile-badge">
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.displayName || user.username}
                className="user-avatar"
                style={{ width: 32, height: 32, borderRadius: 'var(--radius-full)', objectFit: 'cover' }}
              />
            ) : (
              <div className="user-avatar">
                <span>{getInitials(user?.displayName || user?.username)}</span>
              </div>
            )}
            <div className="user-info">
              <span className="user-name">{user?.displayName || user?.username || 'User'}</span>
              <span className="user-status">@{user?.username || 'user'}</span>
            </div>
          </div>
          <div style={{ marginTop: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              type="button"
              onClick={handleLogout}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: '0.8rem',
                cursor: 'pointer',
                padding: 0,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
              title="Sign out of Versora"
            >
              Sign Out &rarr;
            </button>
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {/* Real Persistent Notification Center Bell */}
            <NotificationBell />

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
