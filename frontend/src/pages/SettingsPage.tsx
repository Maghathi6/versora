import React, { useState, useEffect } from 'react';
import { PageHeader } from '../components/common/PageHeader';
import { TerminologyPreview } from '../components/TerminologyPreview';
import { Badge } from '../components/common/Badge';
import { useTerminology } from '../context/TerminologyContext';
import { useAuth } from '../context/AuthContext';
import { userService } from '../services/userService';
import { ApiError } from '../services/apiClient';

export const SettingsPage: React.FC = () => {
  const { mode, setMode } = useTerminology();
  const { user, updateUser } = useAuth();

  // Profile Form States
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [username, setUsername] = useState(user?.username || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [initialData, setInitialData] = useState({
    displayName: user?.displayName || '',
    username: user?.username || '',
    bio: user?.bio || '',
  });

  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Load latest profile from real backend API on mount
  useEffect(() => {
    let isMounted = true;

    const fetchProfile = async () => {
      setIsLoadingProfile(true);
      try {
        const profile = await userService.getMe();
        if (isMounted) {
          setDisplayName(profile.displayName || '');
          setUsername(profile.username || '');
          setBio(profile.bio || '');
          setInitialData({
            displayName: profile.displayName || '',
            username: profile.username || '',
            bio: profile.bio || '',
          });
          updateUser(profile);
        }
      } catch (err) {
        if (isMounted) {
          // Fallback to existing session user if query fails
          if (user) {
            setDisplayName(user.displayName || '');
            setUsername(user.username || '');
            setBio(user.bio || '');
            setInitialData({
              displayName: user.displayName || '',
              username: user.username || '',
              bio: user.bio || '',
            });
          }
          if (err instanceof ApiError && err.status !== 401) {
            setErrorMessage(err.message || 'Unable to load profile information.');
          }
        }
      } finally {
        if (isMounted) {
          setIsLoadingProfile(false);
        }
      }
    };

    fetchProfile();

    return () => {
      isMounted = false;
    };
  }, []);

  const hasChanges =
    displayName.trim() !== initialData.displayName.trim() ||
    username.trim() !== initialData.username.trim() ||
    bio.trim() !== initialData.bio.trim();

  const handleReset = () => {
    setDisplayName(initialData.displayName);
    setUsername(initialData.username);
    setBio(initialData.bio);
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving || !hasChanges) return;

    setErrorMessage(null);
    setSuccessMessage(null);

    const trimmedDisplayName = displayName.trim();
    const trimmedUsername = username.trim();
    const trimmedBio = bio.trim();

    if (!trimmedDisplayName) {
      setErrorMessage('Display name cannot be empty.');
      return;
    }

    if (trimmedUsername.length < 3 || trimmedUsername.length > 30) {
      setErrorMessage('Username must be between 3 and 30 characters.');
      return;
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(trimmedUsername)) {
      setErrorMessage('Username can only contain alphanumeric characters, hyphens, and underscores.');
      return;
    }

    if (bio.length > 500) {
      setErrorMessage('Bio cannot exceed 500 characters.');
      return;
    }

    setIsSaving(true);

    try {
      const updatedUser = await userService.updateMe({
        displayName: trimmedDisplayName,
        username: trimmedUsername,
        bio: trimmedBio ? trimmedBio : null,
      });

      // Synchronize shared auth context state so AppShell updates immediately
      updateUser(updatedUser);

      setDisplayName(updatedUser.displayName);
      setUsername(updatedUser.username);
      setBio(updatedUser.bio || '');
      setInitialData({
        displayName: updatedUser.displayName,
        username: updatedUser.username,
        bio: updatedUser.bio || '',
      });

      setSuccessMessage('Profile updated successfully! Your changes are now active.');
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'DUPLICATE_USERNAME') {
          setErrorMessage('This username is already taken. Please choose another username.');
        } else if (err.code === 'VALIDATION_ERROR') {
          if (Array.isArray(err.details) && err.details.length > 0) {
            const firstDetail = err.details[0] as { issue?: string };
            setErrorMessage(firstDetail?.issue || err.message);
          } else {
            setErrorMessage(err.message || 'Validation error. Please verify the entered information.');
          }
        } else if (err.code === 'NETWORK_ERROR') {
          setErrorMessage('Unable to connect to the backend server. Please verify the API is running.');
        } else {
          setErrorMessage(err.message || 'An error occurred while saving profile changes.');
        }
      } else {
        setErrorMessage('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const getInitials = (name?: string, fallback = 'U'): string => {
    if (!name) return fallback;
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div>
      <PageHeader
        title="Settings & Preferences"
        subtitle="Manage your interface terminology, application diagnostics, and user profile configuration."
        badge={<Badge variant="brand">Active Preferences</Badge>}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '880px' }}>
        {/* Unit 8: Authenticated User Profile Management */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <span>👤</span>
              <span>Personal Profile & Identity</span>
            </div>
            <Badge variant="brand">Authenticated Profile</Badge>
          </div>

          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            Manage your personal profile, display name, and public handle within Versora. These details are associated with all your commit signatures and traceable revisions.
          </p>

          {/* Loading Skeleton Indicator */}
          {isLoadingProfile ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  border: '3px solid rgba(99, 102, 241, 0.2)',
                  borderTopColor: 'var(--brand-primary)',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                  margin: '0 auto 0.75rem auto',
                }}
              />
              <span style={{ fontSize: '0.88rem' }}>Loading profile information...</span>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : (
            <>
              {/* Profile Overview Header Card */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1.25rem',
                  padding: '1.25rem',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-subtle)',
                  marginBottom: '1.5rem',
                }}
              >
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 'var(--radius-full)',
                    background: 'var(--brand-gradient)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '1.2rem',
                    color: '#ffffff',
                    flexShrink: 0,
                    boxShadow: '0 0 16px -2px rgba(99, 102, 241, 0.4)',
                  }}
                >
                  {getInitials(displayName || user?.displayName)}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                      {displayName || 'Unnamed User'}
                    </span>
                    <span style={{ color: 'var(--brand-trace-light)', fontSize: '0.88rem', fontWeight: 500 }}>
                      @{username || 'user'}
                    </span>
                  </div>
                  <div style={{ marginTop: '0.25rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    <span>✉ {user?.email}</span>
                    <span>•</span>
                    <span>UUID: <code style={{ fontSize: '0.78rem' }}>{user?.id?.slice(0, 8)}...</code></span>
                  </div>
                </div>
              </div>

              {/* Success Notification Banner */}
              {successMessage && (
                <div
                  style={{
                    padding: '0.75rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    color: '#34d399',
                    fontSize: '0.86rem',
                    marginBottom: '1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <span>✓</span>
                  <span>{successMessage}</span>
                </div>
              )}

              {/* Error Notification Banner */}
              {errorMessage && (
                <div
                  style={{
                    padding: '0.75rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#f87171',
                    fontSize: '0.86rem',
                    marginBottom: '1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <span>⚠</span>
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Edit Profile Form */}
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
                  {/* Display Name Input */}
                  <div>
                    <label
                      htmlFor="profile-displayname"
                      style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 500 }}
                    >
                      Display Name <span style={{ color: 'var(--status-danger)' }}>*</span>
                    </label>
                    <input
                      id="profile-displayname"
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Dr. Elena Rostova"
                      required
                      disabled={isSaving}
                      style={{
                        width: '100%',
                        padding: '0.65rem 0.85rem',
                        borderRadius: 'var(--radius-md)',
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-primary)',
                        fontSize: '0.9rem',
                        boxSizing: 'border-box',
                      }}
                    />
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.3rem' }}>
                      Your real or professional name displayed across records.
                    </span>
                  </div>

                  {/* Username Input */}
                  <div>
                    <label
                      htmlFor="profile-username"
                      style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 500 }}
                    >
                      Username / Handle <span style={{ color: 'var(--status-danger)' }}>*</span>
                    </label>
                    <input
                      id="profile-username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="dr_elena"
                      required
                      autoCapitalize="none"
                      disabled={isSaving}
                      style={{
                        width: '100%',
                        padding: '0.65rem 0.85rem',
                        borderRadius: 'var(--radius-md)',
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-primary)',
                        fontSize: '0.9rem',
                        boxSizing: 'border-box',
                      }}
                    />
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.3rem' }}>
                      3-30 characters: letters, numbers, hyphens, and underscores.
                    </span>
                  </div>
                </div>

                {/* Email (Read-Only) */}
                <div>
                  <label
                    htmlFor="profile-email-readonly"
                    style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 500 }}
                  >
                    Email Address <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(Immutable Identity)</span>
                  </label>
                  <input
                    id="profile-email-readonly"
                    type="email"
                    value={user?.email || ''}
                    disabled
                    readOnly
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      borderRadius: 'var(--radius-md)',
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-muted)',
                      fontSize: '0.9rem',
                      cursor: 'not-allowed',
                      boxSizing: 'border-box',
                    }}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.3rem' }}>
                    🔒 Account email cannot be changed through profile settings to protect cryptographic audit trails.
                  </span>
                </div>

                {/* Bio / Research Statement */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <label
                      htmlFor="profile-bio"
                      style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}
                    >
                      Bio & Research Statement
                    </label>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        color: bio.length > 500 ? 'var(--status-danger)' : 'var(--text-muted)',
                      }}
                    >
                      {bio.length} / 500 characters
                    </span>
                  </div>
                  <textarea
                    id="profile-bio"
                    rows={3}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Brief description of your research focus, institutional affiliation, or project goals."
                    disabled={isSaving}
                    maxLength={500}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      borderRadius: 'var(--radius-md)',
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                      fontSize: '0.9rem',
                      fontFamily: 'inherit',
                      lineHeight: 1.5,
                      resize: 'vertical',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                {/* Form Action Buttons */}
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    type="submit"
                    disabled={isSaving || !hasChanges}
                    style={{
                      padding: '0.65rem 1.4rem',
                      borderRadius: 'var(--radius-md)',
                      background: hasChanges && !isSaving ? 'var(--brand-gradient)' : 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid var(--border-subtle)',
                      color: hasChanges && !isSaving ? '#ffffff' : 'var(--text-muted)',
                      fontWeight: 600,
                      fontSize: '0.9rem',
                      cursor: hasChanges && !isSaving ? 'pointer' : 'not-allowed',
                      opacity: isSaving ? 0.7 : 1,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      transition: 'all var(--transition-fast)',
                      boxShadow: hasChanges && !isSaving ? '0 0 14px -2px rgba(99, 102, 241, 0.35)' : 'none',
                    }}
                  >
                    {isSaving ? (
                      <>
                        <span
                          style={{
                            width: 14,
                            height: 14,
                            border: '2px solid rgba(255, 255, 255, 0.3)',
                            borderTopColor: '#ffffff',
                            borderRadius: '50%',
                            animation: 'spin 0.8s linear infinite',
                            display: 'inline-block',
                          }}
                        />
                        Saving Changes...
                      </>
                    ) : (
                      'Save Changes'
                    )}
                  </button>

                  {hasChanges && (
                    <button
                      type="button"
                      onClick={handleReset}
                      disabled={isSaving}
                      style={{
                        padding: '0.65rem 1.15rem',
                        borderRadius: 'var(--radius-md)',
                        background: 'transparent',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-secondary)',
                        fontSize: '0.9rem',
                        cursor: isSaving ? 'not-allowed' : 'pointer',
                        transition: 'all var(--transition-fast)',
                      }}
                    >
                      Discard
                    </button>
                  )}

                  {!hasChanges && !isSaving && (
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      No unsaved changes
                    </span>
                  )}
                </div>
              </form>
            </>
          )}
        </div>

        {/* Global Preference: Terminology Mode */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <span>🌐</span>
              <span>Global Interface Terminology Mode</span>
            </div>
            <Badge variant="success">Persisted in LocalStorage</Badge>
          </div>

          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
            Choose how Versora presents version control concepts throughout the entire application. Your preference is saved locally and will remain active across sessions.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div
              onClick={() => setMode('beginner')}
              style={{
                padding: '1.25rem',
                borderRadius: 'var(--radius-md)',
                border: `2px solid ${mode === 'beginner' ? 'var(--brand-trace)' : 'var(--border-subtle)'}`,
                background: mode === 'beginner' ? 'rgba(6, 182, 212, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontWeight: 700, color: 'var(--brand-trace-light)', fontSize: '1rem' }}>
                  🌱 Beginner Mode
                </span>
                {mode === 'beginner' && <Badge variant="info">Selected</Badge>}
              </div>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Uses plain-English, approachable concepts: <em>Projects</em>, <em>Workspaces</em>, <em>Save Changes</em>, and <em>Change Requests</em>. Eliminates Git command anxiety.
              </p>
            </div>

            <div
              onClick={() => setMode('advanced')}
              style={{
                padding: '1.25rem',
                borderRadius: 'var(--radius-md)',
                border: `2px solid ${mode === 'advanced' ? 'var(--brand-primary)' : 'var(--border-subtle)'}`,
                background: mode === 'advanced' ? 'rgba(99, 102, 241, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontWeight: 700, color: 'var(--brand-primary-light)', fontSize: '1rem' }}>
                  ⚡ Advanced Mode
                </span>
                {mode === 'advanced' && <Badge variant="brand">Selected</Badge>}
              </div>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Displays explicit Git terminology: <em>Repositories</em>, <em>Branches</em>, <em>Commits</em>, <em>Pull Requests</em>, and commit hashes. Ideal for experienced engineers.
              </p>
            </div>
          </div>

          {/* Terminology Comparison Table */}
          <TerminologyPreview viewMode={mode} />
        </div>

        {/* System & API Diagnostics */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <span>🔧</span>
              <span>API Diagnostics & Environment</span>
            </div>
            <Badge variant="brand">Phase 1 Foundation</Badge>
          </div>

          <div className="metric-row">
            <span className="metric-label">Frontend API Base URL</span>
            <span className="metric-value font-mono">
              {import.meta.env.VITE_API_BASE_URL || '/api'}
            </span>
          </div>

          <div className="metric-row">
            <span className="metric-label">Backend Target Port</span>
            <span className="metric-value font-mono">4000 (Express REST API)</span>
          </div>

          <div className="metric-row">
            <span className="metric-label">Storage Architecture</span>
            <span className="metric-value font-mono">Tri-Store (PostgreSQL + Git Engine + S3/R2)</span>
          </div>
        </div>

        {/* Planned Integrations (Clear placeholders) */}
        <div className="card" style={{ opacity: 0.75 }}>
          <div className="card-header">
            <div className="card-title">
              <span>🔌</span>
              <span>External Integrations</span>
            </div>
            <Badge variant="neutral">Scheduled for Phase 15</Badge>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
            Optional GitHub synchronization and OAuth token management will be configured here in Phase 15. Versora functions independently without requiring an external GitHub account.
          </p>
        </div>
      </div>
    </div>
  );
};
