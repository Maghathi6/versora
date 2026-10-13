import React from 'react';
import {
  IconGitHub,
  IconUploadCloud,
  IconDownloadCloud,
  IconRefreshCw,
  IconAlertCircle,
  IconCheck,
} from '../common/Icons';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import {
  GitHubOAuthStatusResponse,
  GitHubRemoteStatusResponse,
} from '../../types/github';

interface GitHubSyncBarProps {
  oauthStatus: GitHubOAuthStatusResponse | null;
  remoteStatus: GitHubRemoteStatusResponse | null;
  isLoading: boolean;
  isSyncing: boolean;
  onConnectGitHub: () => void;
  onManageAccount: () => void;
  onPublishClick: () => void;
  onLinkClick: () => void;
  onUnlinkClick: () => void;
  onFetchClick: () => void;
  onOpenPushModal: () => void;
  onOpenPullModal: () => void;
}

export const GitHubSyncBar: React.FC<GitHubSyncBarProps> = ({
  oauthStatus,
  remoteStatus,
  isLoading,
  isSyncing,
  onConnectGitHub,
  onManageAccount,
  onPublishClick,
  onLinkClick,
  onUnlinkClick,
  onFetchClick,
  onOpenPushModal,
  onOpenPullModal,
}) => {
  // If OAuth is not configured on server
  if (oauthStatus && !oauthStatus.isConfigured) {
    return (
      <div
        className="card"
        style={{
          padding: '0.75rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          fontSize: '0.88rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <IconGitHub size={20} style={{ color: 'var(--text-muted)' }} />
          <div>
            <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
              GitHub Integration (Local Dev Mode)
            </span>
            <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              GitHub OAuth credentials not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in backend .env to enable.
            </span>
          </div>
        </div>
        <Badge variant="neutral">Not Configured</Badge>
      </div>
    );
  }

  // If user is not yet connected to GitHub
  if (oauthStatus && !oauthStatus.isConnected) {
    return (
      <div
        className="card"
        style={{
          padding: '0.85rem 1.25rem',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          background: 'linear-gradient(135deg, rgba(36, 41, 47, 0.4) 0%, rgba(22, 27, 34, 0.6) 100%)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 'var(--radius-md)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              background: '#24292f',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(255, 255, 255, 0.15)',
            }}
          >
            <IconGitHub size={20} style={{ color: '#fff' }} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
              Connect with GitHub
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Link your account to publish repositories and synchronize code directly with GitHub.
            </div>
          </div>
        </div>

        <Button
          variant="primary"
          size="sm"
          icon={<IconGitHub size={16} />}
          onClick={onConnectGitHub}
          disabled={isLoading}
        >
          Connect GitHub Account
        </Button>
      </div>
    );
  }

  const account = oauthStatus?.account;
  const isLinked = remoteStatus?.isLinked || false;
  const remote = remoteStatus?.remote;

  return (
    <div
      className="card"
      style={{
        padding: '0.85rem 1.25rem',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
      }}
    >
      {/* Left: GitHub Identity & Linked Remote Info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={onManageAccount}
          title="Manage connected GitHub account"
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          {account?.avatarUrl ? (
            <img
              src={account.avatarUrl}
              alt={account.username}
              style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.2)' }}
            />
          ) : (
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: '#24292f',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <IconGitHub size={16} style={{ color: '#fff' }} />
            </div>
          )}
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            @{account?.username}
          </span>
        </button>

        <span style={{ color: 'var(--border-medium)', userSelect: 'none' }}>|</span>

        {isLinked && remote ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <a
              href={remote.remoteUrl.replace(/\.git$/, '')}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: '0.88rem',
                fontWeight: 700,
                color: 'var(--brand-primary-light)',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <IconGitHub size={15} />
              <span>{remote.owner}/{remote.repo}</span>
            </a>

            <Badge variant={remote.isPrivate ? 'neutral' : 'brand'}>
              {remote.isPrivate ? 'Private' : 'Public'}
            </Badge>

            {/* Sync State Badge */}
            {remoteStatus.syncState === 'up_to_date' && (
              <Badge variant="success">
                <IconCheck size={12} style={{ marginRight: 4 }} />
                Up to Date
              </Badge>
            )}

            {remoteStatus.ahead > 0 && (
              <Badge variant="brand">
                ↑ {remoteStatus.ahead} {remoteStatus.ahead === 1 ? 'commit' : 'commits'} ahead
              </Badge>
            )}

            {remoteStatus.behind > 0 && (
              <Badge variant="warning">
                ↓ {remoteStatus.behind} {remoteStatus.behind === 1 ? 'commit' : 'commits'} behind
              </Badge>
            )}

            {remoteStatus.isDiverged && (
              <Badge variant="danger">
                <IconAlertCircle size={12} style={{ marginRight: 4 }} />
                Diverged
              </Badge>
            )}

            {remoteStatus.hasUncommittedChanges && (
              <span
                style={{
                  fontSize: '0.78rem',
                  color: 'var(--status-warning)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                }}
                title="Save your changes to version history before pushing or pulling"
              >
                <IconAlertCircle size={13} />
                Unsaved modifications
              </span>
            )}
          </div>
        ) : (
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            No remote repository linked to this project yet.
          </span>
        )}
      </div>

      {/* Right: Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        {isLinked ? (
          <>
            {/* Fetch Button */}
            <Button
              variant="ghost"
              size="sm"
              icon={<IconRefreshCw size={14} className={isLoading ? 'spin' : ''} />}
              onClick={onFetchClick}
              disabled={isLoading || isSyncing}
              title="Check GitHub for remote updates without changing local files"
            >
              Fetch
            </Button>

            {/* Pull / Sync Button */}
            <Button
              variant={remoteStatus?.behind && remoteStatus.behind > 0 ? 'primary' : 'outline'}
              size="sm"
              icon={<IconDownloadCloud size={15} />}
              onClick={onOpenPullModal}
              disabled={isLoading || isSyncing || (remoteStatus?.behind === 0 && !remoteStatus?.isDiverged)}
              title={
                remoteStatus?.behind && remoteStatus.behind > 0
                  ? `Pull ${remoteStatus.behind} incoming commits from GitHub`
                  : 'Pull latest commits from GitHub'
              }
            >
              Sync / Pull {remoteStatus?.behind && remoteStatus.behind > 0 ? `(${remoteStatus.behind})` : ''}
            </Button>

            {/* Push Button */}
            <Button
              variant={remoteStatus?.ahead && remoteStatus.ahead > 0 ? 'primary' : 'outline'}
              size="sm"
              icon={<IconUploadCloud size={15} />}
              onClick={onOpenPushModal}
              disabled={isLoading || isSyncing || remoteStatus?.ahead === 0}
              title={
                remoteStatus?.ahead && remoteStatus.ahead > 0
                  ? `Push ${remoteStatus.ahead} local commits to GitHub`
                  : 'Push local commits to GitHub'
              }
            >
              Push {remoteStatus?.ahead && remoteStatus.ahead > 0 ? `(${remoteStatus.ahead})` : ''}
            </Button>

            {/* Unlink button */}
            <button
              type="button"
              className="btn btn-ghost"
              style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '0.35rem 0.6rem' }}
              onClick={onUnlinkClick}
              title="Disconnect this remote repository from the project"
              disabled={isLoading || isSyncing}
            >
              Unlink
            </button>
          </>
        ) : (
          <>
            <Button
              variant="outline"
              size="sm"
              icon={<IconGitHub size={15} />}
              onClick={onLinkClick}
              disabled={isLoading}
            >
              Link Existing Repo
            </Button>

            <Button
              variant="primary"
              size="sm"
              icon={<IconUploadCloud size={15} />}
              onClick={onPublishClick}
              disabled={isLoading}
            >
              Publish to GitHub
            </Button>
          </>
        )}
      </div>
    </div>
  );
};
