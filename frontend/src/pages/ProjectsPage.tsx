import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/common/PageHeader';
import { EmptyState } from '../components/common/EmptyState';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import {
  IconProjects,
  IconPlus,
  IconEdit,
  IconTrash,
  IconAlertCircle,
  IconCheck,
  IconClose,
  IconFolder,
  IconArrowRight,
} from '../components/common/Icons';
import { useTerminology } from '../context/TerminologyContext';
import { projectService } from '../services/projectService';
import { Project } from '../types/project';
import { ApiError } from '../services/apiClient';

export const ProjectsPage: React.FC = () => {
  const navigate = useNavigate();
  const { t, mode } = useTerminology();

  // Data State
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modals & Active State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);

  // Form State
  const [formName, setFormName] = useState<string>('');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Clear messages timer
  const notifySuccess = useCallback((msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 5000);
  }, []);

  // Fetch real projects from PostgreSQL backend API
  const fetchProjects = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await projectService.getProjects();
      setProjects(data);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status !== 401) {
          setErrorMessage(err.message || 'Failed to load projects from server.');
        }
      } else {
        setErrorMessage('An unexpected error occurred while fetching projects.');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Open Create Modal
  const openCreateModal = () => {
    setFormName('');
    setFormDescription('');
    setFormError(null);
    setIsCreateModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (project: Project, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingProject(project);
    setFormName(project.name);
    setFormDescription(project.description || '');
    setFormError(null);
  };

  // Open Delete Confirmation
  const openDeleteModal = (project: Project, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDeletingProject(project);
  };

  // Open Details Modal
  const openDetailsModal = (project: Project) => {
    setSelectedProject(project);
  };

  // Handle Project Creation
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = formName.trim();
    if (!trimmedName) {
      setFormError('Project name cannot be empty.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    try {
      const newProject = await projectService.createProject({
        name: trimmedName,
        description: formDescription.trim() ? formDescription.trim() : null,
      });

      setProjects((prev) => [newProject, ...prev]);
      setIsCreateModalOpen(false);
      notifySuccess(`Project '${newProject.name}' created successfully.`);
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message);
      } else {
        setFormError('Failed to create project. Please verify input.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Project Update
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject) return;

    const trimmedName = formName.trim();
    if (!trimmedName) {
      setFormError('Project name cannot be empty.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    try {
      const updated = await projectService.updateProject(editingProject.id, {
        name: trimmedName,
        description: formDescription.trim() ? formDescription.trim() : null,
      });

      setProjects((prev) =>
        prev.map((p) => (p.id === updated.id ? updated : p))
      );
      if (selectedProject?.id === updated.id) {
        setSelectedProject(updated);
      }
      setEditingProject(null);
      notifySuccess(`Project '${updated.name}' updated successfully.`);
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message);
      } else {
        setFormError('Failed to update project. Please verify input.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Safe Project Deletion
  const handleDeleteConfirm = async () => {
    if (!deletingProject) return;

    setIsSubmitting(true);
    try {
      await projectService.deleteProject(deletingProject.id);
      setProjects((prev) => prev.filter((p) => p.id !== deletingProject.id));
      if (selectedProject?.id === deletingProject.id) {
        setSelectedProject(null);
      }
      const deletedName = deletingProject.name;
      setDeletingProject(null);
      notifySuccess(`Project '${deletedName}' deleted successfully.`);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to delete project.');
      }
      setDeletingProject(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Format timestamp helper
  const formatDate = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div>
      <PageHeader
        title={t('projects')}
        subtitle={`Manage and oversee your real software ${mode === 'beginner' ? 'projects and workspaces' : 'repositories and branches'}.`}
        badge={<Badge variant="brand">Backend Foundation</Badge>}
        actions={
          <Button
            variant="primary"
            icon={<IconPlus size={16} />}
            onClick={openCreateModal}
          >
            New {t('project')}
          </Button>
        }
      />

      {/* Global Alert Banners */}
      {errorMessage && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            padding: '1rem 1.25rem',
            marginBottom: '1.5rem',
            background: 'var(--status-danger-bg)',
            border: '1px solid var(--status-danger-border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--status-danger)',
            fontSize: '0.9rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <IconAlertCircle size={18} />
            <span>{errorMessage}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setErrorMessage(null)}>
            <IconClose size={14} />
          </Button>
        </div>
      )}

      {successMessage && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            padding: '1rem 1.25rem',
            marginBottom: '1.5rem',
            background: 'var(--status-success-bg)',
            border: '1px solid var(--status-success-border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--status-success)',
            fontSize: '0.9rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <IconCheck size={18} />
            <span>{successMessage}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setSuccessMessage(null)}>
            <IconClose size={14} />
          </Button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '5rem 2rem',
            color: 'var(--text-secondary)',
          }}
        >
          <div
            className="health-dot healthy"
            style={{ width: 14, height: 14, marginBottom: '1rem' }}
          />
          <p style={{ fontSize: '0.95rem' }}>Loading projects from database...</p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && projects.length === 0 && (
        <EmptyState
          icon={<IconProjects size={28} />}
          title={`No ${t('projects')} Found`}
          description={`You have not created any projects yet. Get started by provisioning your first project workspace below.`}
          actionText={`Create First ${t('project')}`}
          onAction={openCreateModal}
          technicalNote={`Projects are stored in PostgreSQL with indexed owner queries. Native Git repositories and artifact graphs will attach to these project records in upcoming units.`}
        />
      )}

      {/* Projects Grid / List */}
      {!isLoading && projects.length > 0 && (
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1rem',
            }}
          >
            <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
              Showing {projects.length} {projects.length === 1 ? t('project') : t('projects')}
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
              gap: '1.25rem',
            }}
          >
            {projects.map((project) => (
              <div
                key={project.id}
                className="card"
                onClick={() => navigate(`/projects/${project.id}`)}
                style={{
                  cursor: 'pointer',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  minHeight: '190px',
                }}
              >
                <div>
                  <div className="card-header" style={{ marginBottom: '0.85rem' }}>
                    <div
                      className="card-title"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.6rem',
                        fontSize: '1.05rem',
                      }}
                    >
                      <span style={{ color: 'var(--brand-primary-light)' }}>
                        <IconFolder size={18} />
                      </span>
                      <span
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: '200px',
                        }}
                      >
                        {project.name}
                      </span>
                    </div>
                    <Badge variant="neutral">Owned</Badge>
                  </div>

                  <p
                    style={{
                      fontSize: '0.88rem',
                      color: project.description ? 'var(--text-secondary)' : 'var(--text-muted)',
                      lineHeight: 1.5,
                      marginBottom: '1.25rem',
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {project.description || 'No description provided.'}
                  </p>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: '0.85rem',
                    borderTop: '1px solid var(--border-subtle)',
                    fontSize: '0.8rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  <span>Created {formatDate(project.createdAt)}</span>

                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{
                        padding: '0.28rem 0.65rem',
                        fontSize: '0.78rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                      }}
                      title="Open Workspace"
                      onClick={() => navigate(`/projects/${project.id}`)}
                    >
                      <span>Open</span>
                      <IconArrowRight size={13} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem' }}
                      title="Project info"
                      onClick={() => openDetailsModal(project)}
                    >
                      <IconFolder size={14} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem' }}
                      title="Edit project"
                      onClick={(e) => openEditModal(project, e)}
                    >
                      <IconEdit size={14} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{
                        padding: '0.3rem 0.5rem',
                        fontSize: '0.8rem',
                        color: 'var(--status-danger)',
                      }}
                      title="Delete project"
                      onClick={(e) => openDeleteModal(project, e)}
                    >
                      <IconTrash size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CREATE PROJECT MODAL */}
      {isCreateModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(8, 11, 17, 0.75)',
            backdropFilter: 'blur(8px)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
          }}
          onClick={() => !isSubmitting && setIsCreateModalOpen(false)}
        >
          <div
            className="card"
            style={{
              maxWidth: '520px',
              width: '100%',
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-medium)',
              boxShadow: 'var(--shadow-lg)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-header" style={{ marginBottom: '1.25rem' }}>
              <div className="card-title">
                <IconPlus size={20} />
                <span>Create New {t('project')}</span>
              </div>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ padding: '0.25rem' }}
                onClick={() => setIsCreateModalOpen(false)}
                disabled={isSubmitting}
              >
                <IconClose size={16} />
              </button>
            </div>

            {formError && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem 1rem',
                  marginBottom: '1rem',
                  background: 'var(--status-danger-bg)',
                  border: '1px solid var(--status-danger-border)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--status-danger)',
                  fontSize: '0.85rem',
                }}
              >
                <IconAlertCircle size={16} />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateSubmit}>
              <div style={{ marginBottom: '1.25rem' }}>
                <label
                  htmlFor="create-project-name"
                  style={{
                    display: 'block',
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    marginBottom: '0.5rem',
                    color: 'var(--text-primary)',
                  }}
                >
                  {t('project')} Name *
                </label>
                <input
                  id="create-project-name"
                  type="text"
                  className="form-input"
                  placeholder="e.g. quantum-kernel or Research Paper Analysis"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  maxLength={128}
                  disabled={isSubmitting}
                  required
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.9rem',
                    background: 'var(--bg-app)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                  }}
                />
                <span
                  style={{
                    display: 'block',
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                    marginTop: '0.35rem',
                  }}
                >
                  Maximum 128 characters. Must be unique within your account.
                </span>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label
                  htmlFor="create-project-desc"
                  style={{
                    display: 'block',
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    marginBottom: '0.5rem',
                    color: 'var(--text-primary)',
                  }}
                >
                  Description (Optional)
                </label>
                <textarea
                  id="create-project-desc"
                  rows={3}
                  className="form-input"
                  placeholder="Brief summary of research goals, dataset focus, or software stack..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  maxLength={1000}
                  disabled={isSubmitting}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.9rem',
                    background: 'var(--bg-app)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: '0.75rem',
                }}
              >
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" isLoading={isSubmitting}>
                  Create {t('project')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT PROJECT MODAL */}
      {editingProject && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(8, 11, 17, 0.75)',
            backdropFilter: 'blur(8px)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
          }}
          onClick={() => !isSubmitting && setEditingProject(null)}
        >
          <div
            className="card"
            style={{
              maxWidth: '520px',
              width: '100%',
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-medium)',
              boxShadow: 'var(--shadow-lg)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-header" style={{ marginBottom: '1.25rem' }}>
              <div className="card-title">
                <IconEdit size={20} />
                <span>Edit {t('project')}</span>
              </div>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ padding: '0.25rem' }}
                onClick={() => setEditingProject(null)}
                disabled={isSubmitting}
              >
                <IconClose size={16} />
              </button>
            </div>

            {formError && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem 1rem',
                  marginBottom: '1rem',
                  background: 'var(--status-danger-bg)',
                  border: '1px solid var(--status-danger-border)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--status-danger)',
                  fontSize: '0.85rem',
                }}
              >
                <IconAlertCircle size={16} />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleEditSubmit}>
              <div style={{ marginBottom: '1.25rem' }}>
                <label
                  htmlFor="edit-project-name"
                  style={{
                    display: 'block',
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    marginBottom: '0.5rem',
                    color: 'var(--text-primary)',
                  }}
                >
                  {t('project')} Name *
                </label>
                <input
                  id="edit-project-name"
                  type="text"
                  className="form-input"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  maxLength={128}
                  disabled={isSubmitting}
                  required
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.9rem',
                    background: 'var(--bg-app)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                  }}
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label
                  htmlFor="edit-project-desc"
                  style={{
                    display: 'block',
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    marginBottom: '0.5rem',
                    color: 'var(--text-primary)',
                  }}
                >
                  Description (Optional)
                </label>
                <textarea
                  id="edit-project-desc"
                  rows={3}
                  className="form-input"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  maxLength={1000}
                  disabled={isSubmitting}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.9rem',
                    background: 'var(--bg-app)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: '0.75rem',
                }}
              >
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setEditingProject(null)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" isLoading={isSubmitting}>
                  Save Changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SAFE DELETE CONFIRMATION MODAL */}
      {deletingProject && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(8, 11, 17, 0.75)',
            backdropFilter: 'blur(8px)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
          }}
          onClick={() => !isSubmitting && setDeletingProject(null)}
        >
          <div
            className="card"
            style={{
              maxWidth: '480px',
              width: '100%',
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--status-danger-border)',
              boxShadow: 'var(--shadow-lg)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-header" style={{ marginBottom: '1rem' }}>
              <div className="card-title" style={{ color: 'var(--status-danger)' }}>
                <IconTrash size={20} />
                <span>Confirm Safe Deletion</span>
              </div>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ padding: '0.25rem' }}
                onClick={() => setDeletingProject(null)}
                disabled={isSubmitting}
              >
                <IconClose size={16} />
              </button>
            </div>

            <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
              Are you sure you want to delete <strong style={{ color: 'var(--text-primary)' }}>{deletingProject.name}</strong>?
              This will permanently delete the project record and all associated metadata.
            </p>

            <div
              style={{
                padding: '0.75rem 1rem',
                background: 'rgba(244, 63, 94, 0.08)',
                border: '1px solid var(--status-danger-border)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.82rem',
                color: 'var(--status-danger)',
                marginBottom: '1.5rem',
              }}
            >
              <strong>Safe Deletion Policy:</strong> Only verified project owners can delete projects. This action is irreversible.
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '0.75rem',
              }}
            >
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDeletingProject(null)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                isLoading={isSubmitting}
                onClick={handleDeleteConfirm}
              >
                Delete {t('project')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* PROJECT DETAIL INSPECTION MODAL */}
      {selectedProject && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(8, 11, 17, 0.75)',
            backdropFilter: 'blur(8px)',
            zIndex: 90,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
          }}
          onClick={() => setSelectedProject(null)}
        >
          <div
            className="card"
            style={{
              maxWidth: '620px',
              width: '100%',
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-medium)',
              boxShadow: 'var(--shadow-lg)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-header" style={{ marginBottom: '1.25rem' }}>
              <div className="card-title">
                <IconFolder size={20} />
                <span>{selectedProject.name}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Button
                  variant="primary"
                  size="sm"
                  icon={<IconArrowRight size={14} />}
                  onClick={() => {
                    const pid = selectedProject.id;
                    setSelectedProject(null);
                    navigate(`/projects/${pid}`);
                  }}
                >
                  Open Workspace
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  icon={<IconEdit size={14} />}
                  onClick={() => {
                    const proj = selectedProject;
                    setSelectedProject(null);
                    openEditModal(proj);
                  }}
                >
                  Edit
                </Button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ padding: '0.25rem' }}
                  onClick={() => setSelectedProject(null)}
                >
                  <IconClose size={16} />
                </button>
              </div>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <span style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', fontWeight: 600 }}>
                Description
              </span>
              <p style={{ marginTop: '0.35rem', color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: 1.6 }}>
                {selectedProject.description || 'No description provided for this project.'}
              </p>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '1rem',
                padding: '1rem',
                background: 'rgba(0, 0, 0, 0.25)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                marginBottom: '1.5rem',
                fontSize: '0.85rem',
              }}
            >
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>
                  Project UUID
                </span>
                <code style={{ fontSize: '0.78rem', color: 'var(--brand-trace-light)' }}>
                  {selectedProject.id}
                </code>
              </div>

              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>
                  Owner ID
                </span>
                <code style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  {selectedProject.ownerId}
                </code>
              </div>

              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>
                  Created At
                </span>
                <span>{new Date(selectedProject.createdAt).toLocaleString()}</span>
              </div>

              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>
                  Last Updated
                </span>
                <span>{new Date(selectedProject.updatedAt).toLocaleString()}</span>
              </div>
            </div>

            <div
              style={{
                padding: '0.85rem 1rem',
                background: 'rgba(99, 102, 241, 0.08)',
                border: '1px solid rgba(99, 102, 241, 0.25)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.82rem',
                color: 'var(--brand-primary-light)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.6rem',
              }}
            >
              <IconProjects size={18} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
              <div>
                <strong>Next Platform Stage:</strong> Bare Git repositories and artifact dependency graphs will connect to this project in upcoming units.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
