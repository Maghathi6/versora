import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { PageHeader } from '../components/common/PageHeader';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import {
  IconProjects,
  IconPlus,
  IconFolder,
  IconEdit,
  IconTrash,
  IconAlertCircle,
  IconCheck,
  IconClose,
  IconArrowRight,
  IconSparkles,
  IconLayers,
  IconGitCommit,
  IconHistory,
  IconFileText,
  IconImage,
  IconDownload,
  IconEye,
  IconTable,
  IconPresentation,
  IconTasks,
  IconReviews,
  IconUsers,
  IconMessageSquare,
} from '../components/common/Icons';
import { useTerminology } from '../context/TerminologyContext';
import { projectService } from '../services/projectService';
import { artifactService } from '../services/artifactService';
import { Project } from '../types/project';
import {
  ArtifactItem,
  ArtifactCategory,
  ArtifactCapability,
  getArtifactCapability,
  PreviewData,
} from '../types/artifact';
import { ApiError } from '../services/apiClient';
import { CodeEditor } from '../components/editor/CodeEditor';
import { DocxPreview } from '../components/preview/DocxPreview';
import { XlsxPreview } from '../components/preview/XlsxPreview';
import { PptxPreview } from '../components/preview/PptxPreview';
import { CsvPreview } from '../components/preview/CsvPreview';
import { UnsupportedPreview } from '../components/preview/UnsupportedPreview';
import { gitService } from '../services/gitService';
import {
  GitStatusResponse,
  GitBranchItem,
  GitCommitItem,
} from '../types/git';
import { GitStatusBar } from '../components/git/GitStatusBar';
import { GitInitModal } from '../components/git/GitInitModal';
import { GitCommitModal } from '../components/git/GitCommitModal';
import { GitBranchModal } from '../components/git/GitBranchModal';
import { GitChangesView } from '../components/git/GitChangesView';
import { GitHistoryView } from '../components/git/GitHistoryView';
import { GitRestoreModal } from '../components/git/GitRestoreModal';
import { githubService } from '../services/githubService';
import {
  GitHubOAuthStatusResponse,
  GitHubRemoteStatusResponse,
  GitHubPublishInput,
  GitHubLinkInput,
} from '../types/github';
import {
  GitHubSyncBar,
  GitHubPublishModal,
  GitHubLinkModal,
  GitHubPushModal,
  GitHubPullModal,
  GitHubAccountModal,
} from '../components/github';
import { ProjectActivityTimeline } from '../components/intelligence/ProjectActivityTimeline';
import { ImpactAnalysisCard } from '../components/intelligence/ImpactAnalysisCard';
import { ArtifactTraceabilityModal } from '../components/intelligence/ArtifactTraceabilityModal';
import { CreateArtifactModal } from '../components/artifacts/CreateArtifactModal';
import { ProjectTeamTab } from '../components/collaboration/ProjectTeamTab';
import { ProjectTasksTab } from '../components/collaboration/ProjectTasksTab';
import { ProjectReviewsTab } from '../components/collaboration/ProjectReviewsTab';
import { ArtifactCommentsPanel } from '../components/collaboration/ArtifactCommentsPanel';

type WorkspaceTab = 'overview' | 'files' | 'changes' | 'history' | 'tasks' | 'reviews' | 'team' | 'activity';

export const ProjectWorkspacePage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t, mode } = useTerminology();

  // Navigation tab & folder path from URL
  const tabParam = searchParams.get('tab') as WorkspaceTab | null;
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(
    tabParam && ['overview', 'files', 'changes', 'history', 'tasks', 'reviews', 'team', 'activity'].includes(tabParam)
      ? tabParam
      : 'overview'
  );
  const [isCommentsOpen, setIsCommentsOpen] = useState<boolean>(false);
  const currentFolderId = searchParams.get('folder') || null;

  // Project & Data State
  const [project, setProject] = useState<Project | null>(null);
  const [artifacts, setArtifacts] = useState<ArtifactItem[]>([]);
  const [allProjectArtifacts, setAllProjectArtifacts] = useState<ArtifactItem[]>([]);
  const [allFolders, setAllFolders] = useState<ArtifactItem[]>([]);
  const [currentFolder, setCurrentFolder] = useState<ArtifactItem | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<Array<{ id: string | null; name: string }>>([
    { id: null, name: 'Root' },
  ]);

  // Intelligence & Traceability State
  const [traceabilityArtifact, setTraceabilityArtifact] = useState<ArtifactItem | null>(null);
  const [isTraceabilityModalOpen, setIsTraceabilityModalOpen] = useState<boolean>(false);

  // Loading & Notification State
  const [isLoadingProject, setIsLoadingProject] = useState<boolean>(true);
  const [isLoadingArtifacts, setIsLoadingArtifacts] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadingFileName, setUploadingFileName] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modals
  const [isCreateFolderModalOpen, setIsCreateFolderModalOpen] = useState<boolean>(false);
  const [isCreateArtifactModalOpen, setIsCreateArtifactModalOpen] = useState<boolean>(false);
  const [folderNameInput, setFolderNameInput] = useState<string>('');
  const [renameTarget, setRenameTarget] = useState<ArtifactItem | null>(null);
  const [renameInput, setRenameInput] = useState<string>('');
  const [moveTarget, setMoveTarget] = useState<ArtifactItem | null>(null);
  const [selectedDestinationFolderId, setSelectedDestinationFolderId] = useState<string>('root');
  const [deleteTarget, setDeleteTarget] = useState<ArtifactItem | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSubmittingModal, setIsSubmittingModal] = useState<boolean>(false);

  // Filter query in Files tab
  const [searchFilter, setSearchFilter] = useState<string>('');

  // In-Browser Code Editor & Viewer State
  const [activeEditorFile, setActiveEditorFile] = useState<ArtifactItem | null>(null);
  const [editorContent, setEditorContent] = useState<string>('');
  const [initialEditorContent, setInitialEditorContent] = useState<string>('');
  const [editorLanguage, setEditorLanguage] = useState<string>('plaintext');
  const [isLoadingEditorContent, setIsLoadingEditorContent] = useState<boolean>(false);
  const [isSavingEditorContent, setIsSavingEditorContent] = useState<boolean>(false);
  const [editorErrorMessage, setEditorErrorMessage] = useState<string | null>(null);
  const [isBinaryFile, setIsBinaryFile] = useState<boolean>(false);
  const [binaryWarningItem, setBinaryWarningItem] = useState<ArtifactItem | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);

  // Media & Preview State (Images, PDFs)
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState<boolean>(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [imageZoom, setImageZoom] = useState<number>(1);
  const [richPreviewData, setRichPreviewData] = useState<PreviewData | null>(null);
  const [csvViewMode, setCsvViewMode] = useState<'table' | 'code'>('table');

  // Real Git Engine State
  const [gitStatus, setGitStatus] = useState<GitStatusResponse | null>(null);
  const [gitBranches, setGitBranches] = useState<GitBranchItem[]>([]);
  const [isLoadingGitStatus, setIsLoadingGitStatus] = useState<boolean>(false);
  const [isGitActionLoading, setIsGitActionLoading] = useState<boolean>(false);
  const [gitActionError, setGitActionError] = useState<string | null>(null);

  // Git Modals
  const [isInitModalOpen, setIsInitModalOpen] = useState<boolean>(false);
  const [isCommitModalOpen, setIsCommitModalOpen] = useState<boolean>(false);
  const [isBranchModalOpen, setIsBranchModalOpen] = useState<boolean>(false);
  const [restoreTargetCommit, setRestoreTargetCommit] = useState<GitCommitItem | null>(null);

  // GitHub Integration State
  const [gitHubOAuthStatus, setGitHubOAuthStatus] = useState<GitHubOAuthStatusResponse | null>(null);
  const [gitHubRemoteStatus, setGitHubRemoteStatus] = useState<GitHubRemoteStatusResponse | null>(null);
  const [isLoadingGitHub, setIsLoadingGitHub] = useState<boolean>(false);
  const [isSyncingGitHub, setIsSyncingGitHub] = useState<boolean>(false);
  const [gitHubActionError, setGitHubActionError] = useState<string | null>(null);

  // GitHub Modals
  const [isGitHubPublishModalOpen, setIsGitHubPublishModalOpen] = useState<boolean>(false);
  const [isGitHubLinkModalOpen, setIsGitHubLinkModalOpen] = useState<boolean>(false);
  const [isGitHubPushModalOpen, setIsGitHubPushModalOpen] = useState<boolean>(false);
  const [isGitHubPullModalOpen, setIsGitHubPullModalOpen] = useState<boolean>(false);
  const [isGitHubAccountModalOpen, setIsGitHubAccountModalOpen] = useState<boolean>(false);

  // Clean up blob URL on unmount or file change
  useEffect(() => {
    return () => {
      if (previewBlobUrl) {
        URL.revokeObjectURL(previewBlobUrl);
      }
    };
  }, [previewBlobUrl]);

  // Operational capability of the active file
  const activeCapability = useMemo<ArtifactCapability | null>(() => {
    if (!activeEditorFile) return null;
    return getArtifactCapability(activeEditorFile);
  }, [activeEditorFile]);

  // Unsaved changes confirmation modal state
  const [unsavedPromptTarget, setUnsavedPromptTarget] = useState<
    { type: 'file'; target: ArtifactItem } | { type: 'tab'; target: WorkspaceTab } | { type: 'close' } | null
  >(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const notifySuccess = useCallback((msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 5000);
  }, []);

  const isEditorDirty = useMemo(
    () => editorContent !== initialEditorContent,
    [editorContent, initialEditorContent]
  );

  // Warn before browser window unload or page navigation if there are unsaved edits
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isEditorDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isEditorDirty]);

  // Fetch project details
  const fetchProjectDetails = useCallback(async () => {
    if (!projectId) return;
    setIsLoadingProject(true);
    setErrorMessage(null);
    try {
      const proj = await projectService.getProject(projectId);
      setProject(proj);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message || 'Unable to load project workspace.');
      } else {
        setErrorMessage('An unexpected error occurred loading this project.');
      }
    } finally {
      setIsLoadingProject(false);
    }
  }, [projectId]);

  // Fetch artifacts in current folder
  const fetchArtifacts = useCallback(async () => {
    if (!projectId) return;
    setIsLoadingArtifacts(true);
    try {
      const items = await artifactService.listArtifacts(projectId, currentFolderId);
      setArtifacts(items);

      // Also fetch all artifacts to calculate breadcrumbs and folder hierarchy
      const allItems = await artifactService.listArtifacts(projectId, undefined);
      setAllProjectArtifacts(allItems);
      const foldersOnly = allItems.filter((i) => i.type === 'folder');
      setAllFolders(foldersOnly);

      // Build breadcrumbs path
      if (currentFolderId) {
        const found = allItems.find((i) => i.id === currentFolderId);
        setCurrentFolder(found || null);

        const trail: Array<{ id: string | null; name: string }> = [{ id: null, name: 'Root' }];
        if (found) {
          // Construct ancestor chain
          const ancestors: ArtifactItem[] = [found];
          let cur = found;
          while (cur.parentId) {
            const parent = allItems.find((i) => i.id === cur.parentId);
            if (parent) {
              ancestors.unshift(parent);
              cur = parent;
            } else {
              break;
            }
          }
          ancestors.forEach((a) => trail.push({ id: a.id, name: a.name }));
        }
        setBreadcrumbs(trail);
      } else {
        setCurrentFolder(null);
        setBreadcrumbs([{ id: null, name: 'Root' }]);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message || 'Unable to list artifacts.');
      }
    } finally {
      setIsLoadingArtifacts(false);
    }
  }, [projectId, currentFolderId]);

  // Fetch real Git repository state and local branches
  const fetchGitState = useCallback(async () => {
    if (!projectId) return;
    setIsLoadingGitStatus(true);
    try {
      const status = await gitService.getStatus(projectId);
      setGitStatus(status);
      if (status.isInitialized) {
        try {
          const branchRes = await gitService.getBranches(projectId);
          setGitBranches(branchRes);
        } catch {
          setGitBranches([]);
        }
      } else {
        setGitBranches([]);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setGitActionError(err.message);
      }
    } finally {
      setIsLoadingGitStatus(false);
    }
  }, [projectId]);

  // Fetch GitHub OAuth and remote status
  const fetchGitHubState = useCallback(async () => {
    if (!projectId) return;
    setIsLoadingGitHub(true);
    try {
      const oauth = await githubService.getOAuthStatus();
      setGitHubOAuthStatus(oauth);

      if (oauth.isConnected) {
        try {
          const remote = await githubService.getRemoteStatus(projectId);
          setGitHubRemoteStatus(remote);
        } catch {
          setGitHubRemoteStatus(null);
        }
      } else {
        setGitHubRemoteStatus(null);
      }
    } catch {
      // Ignore offline errors
    } finally {
      setIsLoadingGitHub(false);
    }
  }, [projectId]);

  // Handle GitHub OAuth redirect query parameters in URL
  useEffect(() => {
    const ghStatus = searchParams.get('github');
    const ghUser = searchParams.get('username');
    const ghError = searchParams.get('github_error');

    if (ghStatus === 'connected') {
      notifySuccess(`Successfully connected to GitHub as @${ghUser || 'user'}!`);
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('github');
      newParams.delete('username');
      setSearchParams(newParams, { replace: true });
      fetchGitHubState();
    } else if (ghError) {
      setErrorMessage(`GitHub authorization failed: ${ghError}`);
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('github_error');
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams, setSearchParams, notifySuccess, fetchGitHubState]);

  useEffect(() => {
    fetchProjectDetails();
  }, [fetchProjectDetails]);

  useEffect(() => {
    if (project) {
      fetchArtifacts();
      fetchGitState();
      fetchGitHubState();
    }
  }, [project, fetchArtifacts, fetchGitState, fetchGitHubState]);

  // Navigate folder
  const navigateToFolder = (folderId: string | null) => {
    if (folderId) {
      setSearchParams({ folder: folderId });
    } else {
      setSearchParams({});
    }
  };

  // Open Create Folder Modal
  const openCreateFolderModal = () => {
    setFolderNameInput('');
    setModalError(null);
    setIsCreateFolderModalOpen(true);
  };

  // Handle Folder Creation
  const handleCreateFolderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) return;
    const trimmed = folderNameInput.trim();
    if (!trimmed) {
      setModalError('Folder name cannot be empty.');
      return;
    }

    setIsSubmittingModal(true);
    setModalError(null);
    try {
      const newFolder = await artifactService.createFolder(projectId, {
        name: trimmed,
        parentId: currentFolderId,
      });

      setArtifacts((prev) => [newFolder, ...prev]);
      setAllFolders((prev) => [...prev, newFolder]);
      setIsCreateFolderModalOpen(false);
      notifySuccess(`Folder '${newFolder.name}' created.`);
    } catch (err) {
      if (err instanceof ApiError) {
        setModalError(err.message);
      } else {
        setModalError('Failed to create folder.');
      }
    } finally {
      setIsSubmittingModal(false);
    }
  };

  // Open Create Artifact (File) Modal
  const openCreateArtifactModal = () => {
    setModalError(null);
    setIsCreateArtifactModalOpen(true);
  };

  // Handle Artifact (File) Creation
  const handleCreateArtifactSubmit = async (name: string, initialContent?: string) => {
    if (!projectId) return;

    setIsSubmittingModal(true);
    setModalError(null);
    try {
      const newArtifact = await artifactService.createArtifact(projectId, {
        name,
        parentId: currentFolderId,
        content: initialContent || '',
      });

      // 1. Refresh artifact list and folder contents
      setArtifacts((prev) => [newArtifact, ...prev]);
      setAllProjectArtifacts((prev) => [newArtifact, ...prev]);
      setIsCreateArtifactModalOpen(false);
      notifySuccess(`File '${newArtifact.name}' created successfully.`);

      // 2. Refresh Git status so the new untracked file is reflected
      fetchGitState();

      // 3. Switch to files tab and open in editor if editable
      setActiveTab('files');
      const capability = getArtifactCapability(newArtifact);
      if (capability === 'editable') {
        await openFileDirectly(newArtifact);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setModalError(err.message);
        throw err;
      } else {
        setModalError('Failed to create file.');
        throw err;
      }
    } finally {
      setIsSubmittingModal(false);
    }
  };

  // Trigger file upload browser picker
  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  // Handle File Upload
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !projectId) return;

    // Reset input value so same file can be uploaded again if needed
    e.target.value = '';

    setIsUploading(true);
    setUploadingFileName(file.name);
    try {
      const uploaded = await artifactService.uploadFile(projectId, file, currentFolderId);
      setArtifacts((prev) => [uploaded, ...prev]);
      notifySuccess(`File '${uploaded.name}' uploaded successfully.`);
      fetchGitState();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage(`Failed to upload '${file.name}'.`);
      }
    } finally {
      setIsUploading(false);
      setUploadingFileName(null);
    }
  };

  // Download File
  const handleDownloadFile = async (artifact: ArtifactItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!projectId) return;
    try {
      await artifactService.downloadFile(projectId, artifact.id, artifact.name);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage(`Failed to download '${artifact.name}'.`);
      }
    }
  };

  // Open Rename Modal
  const openRenameModal = (artifact: ArtifactItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenameTarget(artifact);
    setRenameInput(artifact.name);
    setModalError(null);
  };

  // Handle Rename Submit
  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !renameTarget) return;
    const trimmed = renameInput.trim();
    if (!trimmed) {
      setModalError('Name cannot be empty.');
      return;
    }

    setIsSubmittingModal(true);
    setModalError(null);
    try {
      const updated = await artifactService.renameArtifact(projectId, renameTarget.id, {
        name: trimmed,
      });

      setArtifacts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      setRenameTarget(null);
      notifySuccess(`Renamed to '${updated.name}'.`);
      fetchGitState();
    } catch (err) {
      if (err instanceof ApiError) {
        setModalError(err.message);
      } else {
        setModalError('Failed to rename artifact.');
      }
    } finally {
      setIsSubmittingModal(false);
    }
  };

  // Open Move Modal
  const openMoveModal = (artifact: ArtifactItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setMoveTarget(artifact);
    setSelectedDestinationFolderId(artifact.parentId || 'root');
    setModalError(null);
  };

  // Handle Move Submit
  const handleMoveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !moveTarget) return;

    const targetParentId = selectedDestinationFolderId === 'root' ? null : selectedDestinationFolderId;

    setIsSubmittingModal(true);
    setModalError(null);
    try {
      const moved = await artifactService.moveArtifact(projectId, moveTarget.id, {
        targetParentId,
      });

      // Remove from current list if moved to another folder
      setArtifacts((prev) => prev.filter((a) => a.id !== moved.id));
      setMoveTarget(null);
      notifySuccess(`Moved '${moved.name}' successfully.`);
      fetchGitState();
    } catch (err) {
      if (err instanceof ApiError) {
        setModalError(err.message);
      } else {
        setModalError('Failed to move artifact.');
      }
    } finally {
      setIsSubmittingModal(false);
    }
  };

  // Open Delete Modal
  const openDeleteModal = (artifact: ArtifactItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteTarget(artifact);
  };

  // Handle Delete Submit
  const handleDeleteSubmit = async () => {
    if (!projectId || !deleteTarget) return;

    setIsSubmittingModal(true);
    try {
      const res = await artifactService.deleteArtifact(projectId, deleteTarget.id);
      setArtifacts((prev) => prev.filter((a) => a.id !== deleteTarget.id));
      setDeleteTarget(null);
      notifySuccess(res.message);
      fetchGitState();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to delete item.');
      }
      setDeleteTarget(null);
    } finally {
      setIsSubmittingModal(false);
    }
  };

  // Traceability Modal Handlers
  const openTraceabilityModal = (art: ArtifactItem) => {
    setTraceabilityArtifact(art);
    setIsTraceabilityModalOpen(true);
  };

  const handleNavigateToRelatedArtifact = (targetArtifactId: string) => {
    const target = allProjectArtifacts.find((a) => a.id === targetArtifactId);
    if (!target) return;
    setIsTraceabilityModalOpen(false);
    setActiveTab('files');
    handleOpenFile(target);
  };

  // Compute Quick Stats
  const stats = useMemo(() => {
    let filesCount = 0;
    let foldersCount = 0;
    let totalBytes = 0;

    artifacts.forEach((a) => {
      if (a.type === 'folder') {
        foldersCount++;
      } else {
        filesCount++;
        totalBytes += a.sizeBytes;
      }
    });

    return { filesCount, foldersCount, totalBytes };
  }, [artifacts]);

  // Open file in editor / preview / inspector (with unsaved changes guard)
  const handleOpenFile = async (file: ArtifactItem) => {
    if (activeEditorFile && activeEditorFile.id === file.id) return;

    if (isEditorDirty) {
      setUnsavedPromptTarget({ type: 'file', target: file });
      return;
    }

    await openFileDirectly(file);
  };

  // Directly open file in code editor, visual preview, or office document card
  const openFileDirectly = async (file: ArtifactItem) => {
    if (!projectId) return;

    // Reset preview states
    if (previewBlobUrl) {
      URL.revokeObjectURL(previewBlobUrl);
      setPreviewBlobUrl(null);
    }
    setRichPreviewData(null);
    setCsvViewMode('table');
    setPreviewError(null);
    setImageZoom(1);

    setActiveEditorFile(file);
    setIsLoadingEditorContent(false);
    setIsLoadingPreview(false);
    setEditorErrorMessage(null);
    setIsBinaryFile(false);
    setBinaryWarningItem(null);

    const capability = getArtifactCapability(file);
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();

    if (capability === 'editable') {
      setIsLoadingEditorContent(true);
      try {
        const data = await artifactService.getArtifactContent(projectId, file.id);
        setEditorContent(data.content);
        setInitialEditorContent(data.content);
        setEditorLanguage(data.language);
        setIsBinaryFile(false);

        // If CSV or TSV, also fetch structured tabular preview
        if (ext === '.csv' || ext === '.tsv') {
          try {
            const previewRes = await artifactService.getArtifactPreviewData(projectId, file.id);
            setRichPreviewData(previewRes.preview);
            setCsvViewMode('table');
          } catch {
            setCsvViewMode('code');
          }
        }
      } catch (err) {
        if (err instanceof ApiError) {
          if (
            err.message.includes('Binary files') ||
            err.code === 'INVALID_OPERATION' ||
            err.status === 400
          ) {
            setIsBinaryFile(true);
            setBinaryWarningItem(file);
          } else {
            setEditorErrorMessage(err.message || 'Failed to read file content.');
          }
        } else {
          setEditorErrorMessage('An unexpected error occurred reading this file.');
        }
      } finally {
        setIsLoadingEditorContent(false);
      }
    } else if (capability === 'previewable') {
      setIsLoadingPreview(true);
      try {
        // Modern OpenXML documents (.docx, .xlsx, .pptx)
        if (ext === '.docx' || ext === '.xlsx' || ext === '.pptx') {
          const previewRes = await artifactService.getArtifactPreviewData(projectId, file.id);
          setRichPreviewData(previewRes.preview);
        } else {
          // Images and PDF
          const { url } = await artifactService.getArtifactBlob(projectId, file.id);
          setPreviewBlobUrl(url);
        }
      } catch (err) {
        if (err instanceof ApiError) {
          setPreviewError(err.message || 'Failed to load document preview.');
        } else {
          setPreviewError('An unexpected error occurred while loading document preview.');
        }
      } finally {
        setIsLoadingPreview(false);
      }
    } else {
      // capability === 'download-only'
      try {
        const previewRes = await artifactService.getArtifactPreviewData(projectId, file.id);
        setRichPreviewData(previewRes.preview);
      } catch {
        // Fallback provided by getFileFormatInfo
      }
    }
  };

  // Save modified editor content with full resilience & duplicate prevention
  const handleSaveEditorContent = async (contentOverride?: string) => {
    if (!projectId || !activeEditorFile || isSavingEditorContent) return;

    const contentToSave = contentOverride !== undefined ? contentOverride : editorContent;

    setIsSavingEditorContent(true);
    setEditorErrorMessage(null);
    try {
      const updated = await artifactService.updateArtifactContent(
        projectId,
        activeEditorFile.id,
        contentToSave
      );
      setEditorContent(contentToSave);
      setInitialEditorContent(contentToSave);
      setActiveEditorFile(updated);
      setArtifacts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      notifySuccess(`Saved '${updated.name}' successfully.`);
      fetchGitState();
    } catch (err) {
      // Retain unsaved text in editor model and state without loss
      if (err instanceof ApiError) {
        if (err.status === 401 || err.code === 'UNAUTHORIZED') {
          setEditorErrorMessage('Your session has expired. Please sign in again in another tab. Your unsaved changes remain safely in the editor.');
        } else if (err.code === 'NETWORK_ERROR' || err.status === 0) {
          setEditorErrorMessage('Network connection lost. Please check your internet connection. Your unsaved changes remain safely in the editor.');
        } else {
          setEditorErrorMessage(err.message || 'Failed to save changes. Your unsaved changes remain safely in the editor.');
        }
      } else {
        setEditorErrorMessage('An unexpected server error occurred while saving. Your unsaved changes remain safely in the editor.');
      }
    } finally {
      setIsSavingEditorContent(false);
    }
  };

  // Close editor / preview view
  const handleCloseEditor = () => {
    if (isEditorDirty) {
      setUnsavedPromptTarget({ type: 'close' });
      return;
    }
    if (previewBlobUrl) {
      URL.revokeObjectURL(previewBlobUrl);
      setPreviewBlobUrl(null);
    }
    setActiveEditorFile(null);
    setBinaryWarningItem(null);
    setIsBinaryFile(false);
    setRichPreviewData(null);
    setCsvViewMode('table');
    setEditorContent('');
    setInitialEditorContent('');
    setEditorErrorMessage(null);
    setPreviewError(null);
    setImageZoom(1);
  };

  // Sync activeTab with URL search parameters
  useEffect(() => {
    const requestedTab = searchParams.get('tab') as WorkspaceTab | null;
    if (requestedTab && ['overview', 'files', 'changes', 'history', 'tasks', 'reviews', 'team', 'activity'].includes(requestedTab)) {
      setActiveTab(requestedTab);
    }
  }, [searchParams]);

  // Safe tab switching
  const handleSwitchTab = (tab: WorkspaceTab) => {
    if (tab === activeTab) return;
    if (isEditorDirty) {
      setUnsavedPromptTarget({ type: 'tab', target: tab });
      return;
    }
    setActiveTab(tab);
    const newParams = new URLSearchParams(searchParams);
    newParams.set('tab', tab);
    setSearchParams(newParams);
  };

  // Confirm discard unsaved changes and proceed
  const handleConfirmDiscardUnsaved = () => {
    const pending = unsavedPromptTarget;
    setUnsavedPromptTarget(null);
    setEditorContent(initialEditorContent);

    if (!pending) return;

    if (pending.type === 'file') {
      openFileDirectly(pending.target);
    } else if (pending.type === 'tab') {
      if (previewBlobUrl) {
        URL.revokeObjectURL(previewBlobUrl);
        setPreviewBlobUrl(null);
      }
      setActiveEditorFile(null);
      setActiveTab(pending.target);
      const newParams = new URLSearchParams(searchParams);
      newParams.set('tab', pending.target);
      setSearchParams(newParams);
    } else if (pending.type === 'close') {
      handleCloseEditor();
    }
  };

  // Save current changes first and then proceed
  const handleSaveAndProceedUnsaved = async () => {
    if (!projectId || !activeEditorFile || isSavingEditorContent) return;
    setIsSavingEditorContent(true);
    try {
      const updated = await artifactService.updateArtifactContent(
        projectId,
        activeEditorFile.id,
        editorContent
      );
      setInitialEditorContent(editorContent);
      setActiveEditorFile(updated);
      setArtifacts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      notifySuccess(`Saved '${updated.name}' successfully.`);

      const pending = unsavedPromptTarget;
      setUnsavedPromptTarget(null);

      if (pending?.type === 'file') {
        openFileDirectly(pending.target);
      } else if (pending?.type === 'tab') {
        if (previewBlobUrl) {
          URL.revokeObjectURL(previewBlobUrl);
          setPreviewBlobUrl(null);
        }
        setActiveEditorFile(null);
        setActiveTab(pending.target);
      } else if (pending?.type === 'close') {
        handleCloseEditor();
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setEditorErrorMessage(err.message || 'Failed to save changes.');
      } else {
        setEditorErrorMessage('An unexpected error occurred while saving.');
      }
    } finally {
      setIsSavingEditorContent(false);
    }
  };

  // Git Repository Initialization
  const handleInitRepository = async () => {
    if (!projectId || isGitActionLoading) return;
    setIsGitActionLoading(true);
    setGitActionError(null);
    try {
      const res = await gitService.initRepository(projectId);
      setIsInitModalOpen(false);
      notifySuccess(`Git repository initialized successfully on branch '${res.branch}'.`);
      await fetchGitState();
      await fetchArtifacts();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to initialize Git repository.');
      }
    } finally {
      setIsGitActionLoading(false);
    }
  };

  // Save Version (Real Git Commit)
  const handleCommitVersion = async (message: string) => {
    if (!projectId || isGitActionLoading) return;
    setIsGitActionLoading(true);
    setGitActionError(null);
    try {
      const res = await gitService.commit(projectId, message);
      setIsCommitModalOpen(false);
      notifySuccess(`Saved version successfully! Commit ${res.shortHash} — "${res.message}"`);
      await fetchGitState();
    } catch (err) {
      if (err instanceof ApiError) {
        setGitActionError(err.message);
      } else {
        setGitActionError('Failed to save version.');
      }
      throw err;
    } finally {
      setIsGitActionLoading(false);
    }
  };

  // Switch Branch safely
  const handleSwitchBranch = async (branchName: string) => {
    if (!projectId || isGitActionLoading) return;
    if (isEditorDirty) {
      setGitActionError('You have unsaved changes in the editor. Please save or close the editor before switching branches.');
      return;
    }
    setIsGitActionLoading(true);
    setGitActionError(null);
    try {
      const res = await gitService.switchBranch(projectId, branchName);
      setIsBranchModalOpen(false);
      notifySuccess(`Switched to branch '${res.currentBranch}'. Workspace files updated.`);
      handleCloseEditor();
      await fetchGitState();
      await fetchArtifacts();
    } catch (err) {
      if (err instanceof ApiError) {
        setGitActionError(err.message);
      } else {
        setGitActionError('Failed to switch branch.');
      }
      throw err;
    } finally {
      setIsGitActionLoading(false);
    }
  };

  // Create new branch
  const handleCreateBranch = async (branchName: string) => {
    if (!projectId || isGitActionLoading) return;
    setIsGitActionLoading(true);
    setGitActionError(null);
    try {
      const res = await gitService.createBranch(projectId, branchName);
      notifySuccess(`Branch '${res.name}' created successfully.`);
      await fetchGitState();
    } catch (err) {
      if (err instanceof ApiError) {
        setGitActionError(err.message);
      } else {
        setGitActionError('Failed to create branch.');
      }
      throw err;
    } finally {
      setIsGitActionLoading(false);
    }
  };

  // Safe Restoration Confirmation
  const handleRestoreConfirm = async (commitHash: string, mode: 'file' | 'project', filePath?: string) => {
    if (!projectId || isGitActionLoading) return;
    if (isEditorDirty) {
      setGitActionError('Please save or discard your unsaved edits before restoring an earlier version.');
      return;
    }
    setIsGitActionLoading(true);
    setGitActionError(null);
    try {
      const res = await gitService.restore(projectId, commitHash, mode, filePath);
      setRestoreTargetCommit(null);
      notifySuccess(`Restored successfully! ${res.restoredFiles.length} files updated. Safety backup created: ${res.backupRef || 'recorded'}`);
      handleCloseEditor();
      await fetchGitState();
      await fetchArtifacts();
    } catch (err) {
      if (err instanceof ApiError) {
        setGitActionError(err.message);
      } else {
        setGitActionError('Failed to restore version.');
      }
      throw err;
    } finally {
      setIsGitActionLoading(false);
    }
  };

  // Quick navigation from Git Changes view to editor
  const handleOpenFileFromGit = async (filePath: string) => {
    if (!projectId) return;
    try {
      const allItems = await artifactService.listArtifacts(projectId);
      const cleanPath = filePath.replace(/^\/+/, '');
      const match = allItems.find((a) => a.path.replace(/^\/+/, '') === cleanPath);
      if (match) {
        handleSwitchTab('files');
        handleOpenFile(match);
      }
    } catch (err) {
      console.error('Failed to locate file for editor:', err);
    }
  };

  // --- GitHub Remote & OAuth Handlers ---

  const handleConnectGitHub = async () => {
    if (!projectId) return;
    try {
      setIsLoadingGitHub(true);
      const returnTo = `/projects/${projectId}`;
      const res = await githubService.getAuthorizeUrl(returnTo);
      window.location.href = res.authorizeUrl;
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message || 'Unable to start GitHub authorization.');
      }
    } finally {
      setIsLoadingGitHub(false);
    }
  };

  const handleDisconnectGitHub = async () => {
    setIsSyncingGitHub(true);
    setGitHubActionError(null);
    try {
      await githubService.disconnectAccount();
      notifySuccess('GitHub account disconnected successfully.');
      setIsGitHubAccountModalOpen(false);
      await fetchGitHubState();
    } catch (err) {
      if (err instanceof ApiError) {
        setGitHubActionError(err.message);
      } else {
        setGitHubActionError('Failed to disconnect GitHub account.');
      }
    } finally {
      setIsSyncingGitHub(false);
    }
  };

  const handlePublishGitHub = async (input: GitHubPublishInput) => {
    if (!projectId) return;
    setIsSyncingGitHub(true);
    setGitHubActionError(null);
    try {
      const res = await githubService.publish(projectId, input);
      notifySuccess(res.message || 'Successfully published repository to GitHub!');
      setIsGitHubPublishModalOpen(false);
      await Promise.all([fetchGitHubState(), fetchGitState()]);
    } catch (err) {
      if (err instanceof ApiError) {
        setGitHubActionError(err.message);
      } else {
        setGitHubActionError('Failed to publish repository to GitHub.');
      }
    } finally {
      setIsSyncingGitHub(false);
    }
  };

  const handleLinkGitHub = async (input: GitHubLinkInput) => {
    if (!projectId) return;
    setIsSyncingGitHub(true);
    setGitHubActionError(null);
    try {
      const res = await githubService.link(projectId, input);
      notifySuccess(res.message || 'Successfully linked GitHub repository!');
      setIsGitHubLinkModalOpen(false);
      await Promise.all([fetchGitHubState(), fetchGitState()]);
    } catch (err) {
      if (err instanceof ApiError) {
        setGitHubActionError(err.message);
      } else {
        setGitHubActionError('Failed to link GitHub repository.');
      }
    } finally {
      setIsSyncingGitHub(false);
    }
  };

  const handleUnlinkGitHub = async () => {
    if (!projectId) return;
    if (!window.confirm('Are you sure you want to unlink the GitHub remote from this project? Your local repository and files will remain untouched.')) {
      return;
    }
    setIsSyncingGitHub(true);
    try {
      const res = await githubService.unlink(projectId);
      notifySuccess(res.message || 'GitHub remote unlinked.');
      await fetchGitHubState();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message || 'Failed to unlink repository.');
      }
    } finally {
      setIsSyncingGitHub(false);
    }
  };

  const handleFetchGitHub = async () => {
    if (!projectId) return;
    setIsSyncingGitHub(true);
    try {
      const res = await githubService.fetchRemote(projectId);
      notifySuccess(res.message || 'Remote references updated from GitHub.');
      await fetchGitHubState();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message || 'Failed to fetch from GitHub.');
      }
    } finally {
      setIsSyncingGitHub(false);
    }
  };

  const handlePushGitHub = async () => {
    if (!projectId) return;
    setIsSyncingGitHub(true);
    setGitHubActionError(null);
    try {
      const res = await githubService.push(projectId);
      notifySuccess(res.message || 'Successfully pushed commits to GitHub!');
      setIsGitHubPushModalOpen(false);
      await Promise.all([fetchGitHubState(), fetchGitState()]);
    } catch (err) {
      if (err instanceof ApiError) {
        setGitHubActionError(err.message);
      } else {
        setGitHubActionError('Failed to push commits to GitHub.');
      }
    } finally {
      setIsSyncingGitHub(false);
    }
  };

  const handlePullGitHub = async () => {
    if (!projectId) return;
    setIsSyncingGitHub(true);
    setGitHubActionError(null);
    try {
      const res = await githubService.pull(projectId);
      notifySuccess(res.message || 'Successfully synchronized with GitHub!');
      setIsGitHubPullModalOpen(false);
      await Promise.all([fetchGitHubState(), fetchGitState(), fetchArtifacts()]);
    } catch (err) {
      if (err instanceof ApiError) {
        setGitHubActionError(err.message);
      } else {
        setGitHubActionError('Failed to pull commits from GitHub.');
      }
    } finally {
      setIsSyncingGitHub(false);
    }
  };

  // Format file size helper
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  // Operational Capability Badge Helper
  const renderCapabilityBadge = (capability: ArtifactCapability) => {
    switch (capability) {
      case 'editable':
        return <Badge variant="brand">Editable</Badge>;
      case 'previewable':
        return <Badge variant="success">Preview</Badge>;
      case 'download-only':
        return <Badge variant="neutral">Download Only</Badge>;
    }
  };

  // Context-aware file format icon helper
  const getItemIcon = (item: ArtifactItem, size = 18) => {
    if (item.type === 'folder') return <IconFolder size={size} />;
    const ext = item.name.lastIndexOf('.') !== -1 ? item.name.slice(item.name.lastIndexOf('.')).toLowerCase() : '';
    if (ext === '.docx' || ext === '.doc') return <IconFileText size={size} style={{ color: '#3b82f6' }} />;
    if (ext === '.xlsx' || ext === '.xls' || ext === '.csv' || ext === '.tsv') return <IconTable size={size} style={{ color: '#10b981' }} />;
    if (ext === '.pptx' || ext === '.ppt') return <IconPresentation size={size} style={{ color: '#ef4444' }} />;
    if (ext === '.pdf') return <IconFileText size={size} style={{ color: '#f59e0b' }} />;
    const cap = getArtifactCapability(item);
    if (cap === 'previewable') return <IconImage size={size} style={{ color: '#10b981' }} />;
    if (cap === 'download-only') return <IconFileText size={size} style={{ color: '#8b5cf6' }} />;
    return <IconLayers size={size} style={{ color: 'var(--brand-trace-light)' }} />;
  };

  // Helper for human-friendly Office and Binary labels
  const getFileFormatInfo = (filename: string, _mimeType?: string | null) => {
    const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
    switch (ext) {
      case '.docx':
      case '.doc':
        return {
          title: 'Microsoft Word Document (.docx)',
          category: 'Word Document',
          desc: 'This file is a Word document. Versora maintains your original document bytes intact. Download the file to view or edit in Microsoft Word, LibreOffice, or Google Docs.',
          iconBg: 'rgba(59, 130, 246, 0.15)',
          iconColor: '#3b82f6',
        };
      case '.xlsx':
      case '.xls':
        return {
          title: 'Microsoft Excel Spreadsheet (.xlsx)',
          category: 'Excel Spreadsheet',
          desc: 'This file is an Excel spreadsheet. Download the file to inspect worksheets, formulas, or datasets in Microsoft Excel or Google Sheets.',
          iconBg: 'rgba(16, 185, 129, 0.15)',
          iconColor: '#10b981',
        };
      case '.pptx':
      case '.ppt':
        return {
          title: 'Microsoft PowerPoint Presentation (.pptx)',
          category: 'PowerPoint Presentation',
          desc: 'This file is a slide presentation. Download the file to open or present in Microsoft PowerPoint or Keynote.',
          iconBg: 'rgba(239, 68, 68, 0.15)',
          iconColor: '#ef4444',
        };
      case '.zip':
      case '.tar':
      case '.gz':
      case '.7z':
      case '.rar':
        return {
          title: `Compressed Archive (${ext.toUpperCase().slice(1)})`,
          category: 'Archive',
          desc: 'This file is a compressed package. Download the archive to extract and examine files on your machine.',
          iconBg: 'rgba(245, 158, 11, 0.15)',
          iconColor: '#f59e0b',
        };
      default:
        return {
          title: `Binary / Non-Text File (${ext ? ext.toUpperCase() : 'BINARY'})`,
          category: 'Binary File',
          desc: 'This file is in a binary format and cannot be decoded into editable code. Download the intact original file to inspect it on your computer.',
          iconBg: 'rgba(139, 92, 246, 0.15)',
          iconColor: '#8b5cf6',
        };
    }
  };

  // Filter artifacts
  const filteredArtifacts = useMemo(() => {
    if (!searchFilter.trim()) return artifacts;
    const lower = searchFilter.toLowerCase();
    return artifacts.filter((a) => a.name.toLowerCase().includes(lower));
  }, [artifacts, searchFilter]);

  // Artifact Category Badge Helper
  const renderCategoryBadge = (category: ArtifactCategory) => {
    switch (category) {
      case 'code':
        return <Badge variant="brand">Code</Badge>;
      case 'document':
        return <Badge variant="info">Doc</Badge>;
      case 'dataset':
        return <Badge variant="success">Data</Badge>;
      case 'model':
        return <Badge variant="warning">Model</Badge>;
      case 'result':
        return <Badge variant="neutral">Result</Badge>;
      case 'presentation':
        return <Badge variant="info">Slides</Badge>;
      case 'folder':
        return <Badge variant="neutral">Folder</Badge>;
      default:
        return <Badge variant="neutral">File</Badge>;
    }
  };

  if (isLoadingProject) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '6rem 2rem' }}>
        <div className="health-dot healthy" style={{ width: 14, height: 14, marginBottom: '1rem' }} />
        <p style={{ color: 'var(--text-secondary)' }}>Loading project workspace...</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <IconAlertCircle size={36} style={{ color: 'var(--status-danger)', marginBottom: '1rem' }} />
        <h2 style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>Project Not Found</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          The requested project workspace could not be found or you do not have permission to view it.
        </p>
        <Link to="/projects" className="btn btn-primary">
          Back to Projects
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Hidden file upload input */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* Breadcrumb Back Link */}
      <div style={{ marginBottom: '1rem' }}>
        <Link
          to="/projects"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            fontSize: '0.85rem',
            color: 'var(--text-secondary)',
          }}
        >
          <span>← Back to {t('projects')}</span>
        </Link>
      </div>

      <PageHeader
        title={project.name}
        subtitle={project.description || `Real software project workspace in ${mode === 'beginner' ? 'Beginner' : 'Advanced'} Mode.`}
        badge={<Badge variant="brand">Workspace Active</Badge>}
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Button
              variant="outline"
              size="sm"
              icon={<IconPlus size={14} />}
              onClick={openCreateArtifactModal}
            >
              New File
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={<IconPlus size={14} />}
              onClick={openCreateFolderModal}
            >
              New Folder
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<IconPlus size={14} />}
              onClick={triggerFileUpload}
              isLoading={isUploading}
            >
              Upload File
            </Button>
          </div>
        }
      />

      {/* Global Alerts */}
      {errorMessage && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
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

      {/* Uploading Banner */}
      {isUploading && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.85rem 1.25rem',
            marginBottom: '1.5rem',
            background: 'rgba(99, 102, 241, 0.1)',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.9rem',
            color: 'var(--brand-primary-light)',
          }}
        >
          <div className="health-dot healthy" style={{ width: 10, height: 10 }} />
          <span>Uploading <strong>{uploadingFileName}</strong> to workspace storage...</span>
        </div>
      )}

      {/* Git Real Version Control Status Bar */}
      <div style={{ marginBottom: '0.75rem' }}>
        <GitStatusBar
          status={gitStatus}
          isLoading={isLoadingGitStatus}
          onInitClick={() => setIsInitModalOpen(true)}
          onBranchClick={() => {
            setGitActionError(null);
            setIsBranchModalOpen(true);
          }}
          onSaveVersionClick={() => {
            setGitActionError(null);
            setIsCommitModalOpen(true);
          }}
          onViewChangesClick={() => handleSwitchTab('changes')}
          onViewHistoryClick={() => handleSwitchTab('history')}
        />
      </div>

      {/* GitHub Remote Integration & Synchronization Bar */}
      <div style={{ marginBottom: '1.25rem' }}>
        <GitHubSyncBar
          oauthStatus={gitHubOAuthStatus}
          remoteStatus={gitHubRemoteStatus}
          isLoading={isLoadingGitHub}
          isSyncing={isSyncingGitHub}
          onConnectGitHub={handleConnectGitHub}
          onManageAccount={() => setIsGitHubAccountModalOpen(true)}
          onPublishClick={() => {
            setGitHubActionError(null);
            setIsGitHubPublishModalOpen(true);
          }}
          onLinkClick={() => {
            setGitHubActionError(null);
            setIsGitHubLinkModalOpen(true);
          }}
          onUnlinkClick={handleUnlinkGitHub}
          onFetchClick={handleFetchGitHub}
          onOpenPushModal={() => {
            setGitHubActionError(null);
            setIsGitHubPushModalOpen(true);
          }}
          onOpenPullModal={() => {
            setGitHubActionError(null);
            setIsGitHubPullModalOpen(true);
          }}
        />
      </div>

      {/* Workspace Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '1rem',
          borderBottom: '1px solid var(--border-subtle)',
          marginBottom: '1.75rem',
        }}
      >
        <button
          type="button"
          onClick={() => handleSwitchTab('overview')}
          style={{
            padding: '0.6rem 0.2rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'overview' ? '2px solid var(--brand-primary)' : '2px solid transparent',
            color: activeTab === 'overview' ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'overview' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '0.92rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}
        >
          <IconProjects size={16} />
          <span>Overview</span>
        </button>

        <button
          type="button"
          onClick={() => handleSwitchTab('files')}
          style={{
            padding: '0.6rem 0.2rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'files' ? '2px solid var(--brand-primary)' : '2px solid transparent',
            color: activeTab === 'files' ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'files' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '0.92rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}
        >
          <IconFolder size={16} />
          <span>Files & Editor</span>
          <Badge variant="neutral">{artifacts.length}</Badge>
        </button>

        <button
          type="button"
          onClick={() => handleSwitchTab('changes')}
          style={{
            padding: '0.6rem 0.2rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'changes' ? '2px solid var(--brand-primary)' : '2px solid transparent',
            color: activeTab === 'changes' ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'changes' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '0.92rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}
        >
          <IconGitCommit size={16} />
          <span>Changes & Save</span>
          {gitStatus?.isInitialized && gitStatus.totalChangesCount > 0 ? (
            <Badge variant="warning">{gitStatus.totalChangesCount}</Badge>
          ) : null}
        </button>

        <button
          type="button"
          onClick={() => handleSwitchTab('history')}
          style={{
            padding: '0.6rem 0.2rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'history' ? '2px solid var(--brand-primary)' : '2px solid transparent',
            color: activeTab === 'history' ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'history' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '0.92rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}
        >
          <IconHistory size={16} />
          <span>Version History</span>
        </button>

        <button
          type="button"
          onClick={() => handleSwitchTab('tasks')}
          style={{
            padding: '0.6rem 0.2rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'tasks' ? '2px solid var(--brand-primary)' : '2px solid transparent',
            color: activeTab === 'tasks' ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'tasks' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '0.92rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}
        >
          <IconTasks size={16} />
          <span>Tasks</span>
        </button>

        <button
          type="button"
          onClick={() => handleSwitchTab('reviews')}
          style={{
            padding: '0.6rem 0.2rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'reviews' ? '2px solid var(--brand-primary)' : '2px solid transparent',
            color: activeTab === 'reviews' ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'reviews' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '0.92rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}
        >
          <IconReviews size={16} />
          <span>Reviews</span>
        </button>

        <button
          type="button"
          onClick={() => handleSwitchTab('team')}
          style={{
            padding: '0.6rem 0.2rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'team' ? '2px solid var(--brand-primary)' : '2px solid transparent',
            color: activeTab === 'team' ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'team' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '0.92rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}
        >
          <IconUsers size={16} />
          <span>Team</span>
        </button>

        <button
          type="button"
          onClick={() => handleSwitchTab('activity')}
          style={{
            padding: '0.6rem 0.2rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'activity' ? '2px solid var(--brand-primary)' : '2px solid transparent',
            color: activeTab === 'activity' ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'activity' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '0.92rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}
        >
          <IconLayers size={16} />
          <span>Activity & Roadmap</span>
        </button>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div>
          {/* Quick Stats Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '1rem',
              marginBottom: '2rem',
            }}
          >
            <div className="card" style={{ padding: '1.25rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Files in Folder
              </span>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.35rem', color: 'var(--text-primary)' }}>
                {stats.filesCount}
              </div>
            </div>

            <div className="card" style={{ padding: '1.25rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Folders
              </span>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.35rem', color: 'var(--text-primary)' }}>
                {stats.foldersCount}
              </div>
            </div>

            <div className="card" style={{ padding: '1.25rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Storage Used
              </span>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.35rem', color: 'var(--brand-trace-light)' }}>
                {formatBytes(stats.totalBytes)}
              </div>
            </div>

            <div className="card" style={{ padding: '1.25rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Active Mode
              </span>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, marginTop: '0.6rem', color: 'var(--brand-primary-light)' }}>
                {mode === 'beginner' ? '🌱 Beginner' : '⚡ Advanced'}
              </div>
            </div>
          </div>

          {/* Project Metadata Card */}
          <div className="card" style={{ marginBottom: '2rem' }}>
            <div className="card-header">
              <div className="card-title">
                <IconProjects size={18} />
                <span>Project Workspace Specification</span>
              </div>
              <Badge variant="brand">PostgreSQL Backed</Badge>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '1.25rem',
                fontSize: '0.88rem',
              }}
            >
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                  Project Name
                </span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{project.name}</span>
              </div>

              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                  Project UUID
                </span>
                <code style={{ color: 'var(--brand-trace-light)', fontSize: '0.82rem' }}>{project.id}</code>
              </div>

              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                  Owner ID
                </span>
                <code style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>{project.ownerId}</code>
              </div>

              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                  Created At
                </span>
                <span>{new Date(project.createdAt).toLocaleString()}</span>
              </div>
            </div>

            <div
              style={{
                marginTop: '1.5rem',
                padding: '1rem',
                background: 'rgba(99, 102, 241, 0.08)',
                border: '1px solid rgba(99, 102, 241, 0.25)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.85rem',
                lineHeight: 1.5,
                color: 'var(--text-secondary)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--brand-primary-light)', fontWeight: 600, marginBottom: '0.35rem' }}>
                <IconSparkles size={16} />
                <span>Versora Engine Roadmap</span>
              </div>
              Files uploaded to this workspace are saved on server storage with metadata persisted in PostgreSQL. In upcoming units, this project will attach to an authentic, bare Git repository, enabling change commits, version tags, and cross-artifact impact analysis.
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: FILES & CODE EDITOR */}
      {activeTab === 'files' && (
        <div>
          {/* Breadcrumb Navigation & Action Bar */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              marginBottom: '1.25rem',
              padding: '0.75rem 1rem',
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            {/* Breadcrumb Trail */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.9rem' }}>
              {breadcrumbs.map((b, idx) => (
                <React.Fragment key={idx}>
                  {idx > 0 && <span style={{ color: 'var(--text-muted)' }}>/</span>}
                  <button
                    type="button"
                    onClick={() => navigateToFolder(b.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: idx === breadcrumbs.length - 1 ? 'var(--text-primary)' : 'var(--brand-primary-light)',
                      fontWeight: idx === breadcrumbs.length - 1 ? 700 : 500,
                      cursor: idx === breadcrumbs.length - 1 ? 'default' : 'pointer',
                      padding: 0,
                    }}
                  >
                    {b.name}
                  </button>
                </React.Fragment>
              ))}
            </div>

            {/* Search Filter & Quick Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <input
                type="text"
                placeholder="Filter files..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                style={{
                  padding: '0.4rem 0.75rem',
                  fontSize: '0.85rem',
                  background: 'var(--bg-app)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  width: '160px',
                }}
              />
              <Button variant="ghost" size="sm" onClick={fetchArtifacts}>
                Refresh
              </Button>
            </div>
          </div>

          {/* Dual-Pane Editor Layout when a file is open */}
          {activeEditorFile ? (
            <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'stretch', minHeight: '620px' }}>
              {/* Left Explorer Sidebar */}
              {!isSidebarCollapsed && (
                <div
                  style={{
                    width: '280px',
                    flexShrink: 0,
                    background: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '0.85rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.65rem',
                    overflowY: 'auto',
                    maxHeight: '750px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
                      Explorer
                    </span>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}
                      onClick={handleCloseEditor}
                      title="Return to full file list"
                    >
                      Table View
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <Button variant="outline" size="sm" onClick={openCreateArtifactModal} style={{ flex: 1, fontSize: '0.75rem', padding: '0.25rem' }}>
                      + File
                    </Button>
                    <Button variant="outline" size="sm" onClick={openCreateFolderModal} style={{ flex: 1, fontSize: '0.75rem', padding: '0.25rem' }}>
                      + Folder
                    </Button>
                    <Button variant="primary" size="sm" onClick={triggerFileUpload} style={{ flex: 1, fontSize: '0.75rem', padding: '0.25rem' }}>
                      + Upload
                    </Button>
                  </div>

                  {/* Sidebar Item List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', marginTop: '0.25rem' }}>
                    {filteredArtifacts.map((item) => {
                      const isSelected = activeEditorFile?.id === item.id;
                      return (
                        <div
                          key={item.id}
                          onClick={() => {
                            if (item.type === 'folder') {
                              navigateToFolder(item.id);
                            } else {
                              handleOpenFile(item);
                            }
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.45rem 0.65rem',
                            borderRadius: 'var(--radius-md)',
                            background: isSelected ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                            border: isSelected ? '1px solid rgba(99, 102, 241, 0.35)' : '1px solid transparent',
                            color: isSelected ? 'var(--brand-primary-light)' : 'var(--text-primary)',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            transition: 'all var(--transition-fast)',
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected) e.currentTarget.style.background = 'var(--bg-card-hover)';
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                            <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                              {getItemIcon(item, 15)}
                            </span>
                            <span
                              style={{
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                fontWeight: isSelected ? 700 : 400,
                              }}
                            >
                              {item.name}
                            </span>
                          </div>

                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                            {item.type === 'folder' ? 'dir' : formatBytes(item.sizeBytes)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Right Viewer & Editor Area */}
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                <div style={{ marginBottom: '0.65rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ fontSize: '0.8rem', padding: '0.25rem 0.6rem' }}
                    onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                  >
                    {isSidebarCollapsed ? '▶ Show File Explorer' : '◀ Hide File Explorer'}
                  </button>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {activeEditorFile && (
                      <>
                        <Button
                          variant={isCommentsOpen ? 'primary' : 'outline'}
                          size="sm"
                          onClick={() => setIsCommentsOpen(!isCommentsOpen)}
                        >
                          <IconMessageSquare size={13} style={{ marginRight: '0.35rem' }} />
                          {isCommentsOpen ? 'Hide Discussions' : 'Discussions'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openTraceabilityModal(activeEditorFile)}
                        >
                          <IconSparkles size={13} style={{ marginRight: '0.35rem' }} />
                          Traceability & Relationships
                        </Button>
                      </>
                    )}
                    <Button variant="ghost" size="sm" onClick={handleCloseEditor}>
                      Close Viewer & View Full Table
                    </Button>
                  </div>
                </div>

                {/* 1. EDITABLE (Monaco Code Editor) */}
                {activeCapability === 'editable' && (
                  <>
                    {isLoadingEditorContent && (
                      <div
                        style={{
                          flex: 1,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '6rem 2rem',
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-lg)',
                        }}
                      >
                        <div className="health-dot healthy" style={{ width: 14, height: 14, marginBottom: '0.85rem' }} />
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>Loading {activeEditorFile.name}...</p>
                      </div>
                    )}

                    {!isLoadingEditorContent && isBinaryFile && binaryWarningItem && (
                      <div
                        className="card"
                        style={{
                          flex: 1,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '4rem 2rem',
                          textAlign: 'center',
                          background: 'var(--bg-surface-elevated)',
                          border: '1px solid var(--border-medium)',
                        }}
                      >
                        <div style={{ color: 'var(--brand-primary-light)', marginBottom: '1.25rem' }}>
                          <IconLayers size={44} />
                        </div>
                        <h3 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '0.6rem' }}>
                          {binaryWarningItem.name}
                        </h3>
                        <p style={{ color: 'var(--text-secondary)', maxWidth: '480px', margin: '0 auto 1.75rem auto', lineHeight: 1.6, fontSize: '0.92rem' }}>
                          This file cannot be decoded into editable code. You can download the file to inspect it on your computer.
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
                          <Button
                            variant="primary"
                            onClick={(e) => handleDownloadFile(binaryWarningItem, e)}
                          >
                            Download File ({formatBytes(binaryWarningItem.sizeBytes)})
                          </Button>
                          <Button variant="ghost" onClick={handleCloseEditor}>
                            Back to File List
                          </Button>
                        </div>
                      </div>
                    )}

                    {!isLoadingEditorContent && !isBinaryFile && (
                      (() => {
                        const ext = activeEditorFile.name.slice(activeEditorFile.name.lastIndexOf('.')).toLowerCase();
                        if ((ext === '.csv' || ext === '.tsv') && csvViewMode === 'table' && richPreviewData?.kind === 'csv') {
                          return (
                            <CsvPreview
                              artifact={activeEditorFile}
                              data={richPreviewData}
                              onEditInCodeEditor={() => setCsvViewMode('code')}
                              onDownload={() => handleDownloadFile(activeEditorFile, { stopPropagation: () => {} } as any)}
                              onClose={handleCloseEditor}
                            />
                          );
                        }
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
                            {(ext === '.csv' || ext === '.tsv') && richPreviewData?.kind === 'csv' && (
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '0.4rem 1rem',
                                  background: 'var(--bg-surface-elevated)',
                                  borderBottom: '1px solid var(--border-medium)',
                                }}
                              >
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                  Editing raw text. Switch to interactive table view anytime.
                                </span>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  icon={<IconTable size={14} />}
                                  onClick={() => setCsvViewMode('table')}
                                >
                                  View Table Preview
                                </Button>
                              </div>
                            )}
                            <CodeEditor
                              filename={activeEditorFile.name}
                              filePath={activeEditorFile.path}
                              language={editorLanguage}
                              initialValue={editorContent}
                              isDirty={isEditorDirty}
                              isSaving={isSavingEditorContent}
                              errorMessage={editorErrorMessage}
                              onChange={(val) => setEditorContent(val)}
                              onSave={handleSaveEditorContent}
                              onClose={handleCloseEditor}
                              onDownload={() => handleDownloadFile(activeEditorFile, { stopPropagation: () => {} } as any)}
                            />
                          </div>
                        );
                      })()
                    )}
                  </>
                )}

                {/* 2. PREVIEWABLE (DOCX, XLSX, PPTX, Images, and PDF Previews) */}
                {activeCapability === 'previewable' && (
                  (() => {
                    if (isLoadingPreview) {
                      return (
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minHeight: '560px',
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-lg)',
                            padding: '4rem 2rem',
                          }}
                        >
                          <div className="health-dot healthy" style={{ width: 14, height: 14, marginBottom: '0.85rem' }} />
                          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>Loading document preview...</p>
                        </div>
                      );
                    }

                    if (previewError) {
                      return (
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minHeight: '560px',
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-lg)',
                            padding: '4rem 2rem',
                            textAlign: 'center',
                          }}
                        >
                          <div style={{ color: 'var(--status-danger)', marginBottom: '1rem' }}>
                            <IconAlertCircle size={36} />
                          </div>
                          <h4 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>Unable to Display Preview</h4>
                          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', maxWidth: '420px', marginBottom: '1.5rem' }}>
                            {previewError}
                          </p>
                          <Button variant="primary" onClick={(e) => handleDownloadFile(activeEditorFile, e)}>
                            Download Original File
                          </Button>
                        </div>
                      );
                    }

                    if (richPreviewData) {
                      if (richPreviewData.kind === 'docx') {
                        return (
                          <DocxPreview
                            artifact={activeEditorFile}
                            data={richPreviewData}
                            onDownload={() => handleDownloadFile(activeEditorFile, { stopPropagation: () => {} } as any)}
                            onClose={handleCloseEditor}
                          />
                        );
                      }
                      if (richPreviewData.kind === 'xlsx') {
                        return (
                          <XlsxPreview
                            artifact={activeEditorFile}
                            data={richPreviewData}
                            onDownload={() => handleDownloadFile(activeEditorFile, { stopPropagation: () => {} } as any)}
                            onClose={handleCloseEditor}
                          />
                        );
                      }
                      if (richPreviewData.kind === 'pptx') {
                        return (
                          <PptxPreview
                            artifact={activeEditorFile}
                            data={richPreviewData}
                            onDownload={() => handleDownloadFile(activeEditorFile, { stopPropagation: () => {} } as any)}
                            onClose={handleCloseEditor}
                          />
                        );
                      }
                      if (richPreviewData.kind === 'error') {
                        return (
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              minHeight: '560px',
                              background: 'var(--bg-card)',
                              border: '1px solid var(--border-subtle)',
                              borderRadius: 'var(--radius-lg)',
                              padding: '4rem 2rem',
                              textAlign: 'center',
                            }}
                          >
                            <div style={{ color: '#f59e0b', marginBottom: '1rem' }}>
                              <IconAlertCircle size={36} />
                            </div>
                            <h4 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.5rem' }}>Preview Unavailable</h4>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '460px', marginBottom: '1.5rem' }}>
                              {richPreviewData.message}
                            </p>
                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                              <Button variant="primary" onClick={(e) => handleDownloadFile(activeEditorFile, e)}>
                                Download Original File
                              </Button>
                              <Button variant="ghost" onClick={handleCloseEditor}>
                                Close
                              </Button>
                            </div>
                          </div>
                        );
                      }
                    }

                    // Fallback to Image or PDF visual preview
                    return (
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          height: '100%',
                          minHeight: '560px',
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-lg)',
                          overflow: 'hidden',
                          boxShadow: 'var(--shadow-md)',
                        }}
                      >
                        {/* Preview Top Bar */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '0.75rem',
                            padding: '0.65rem 1rem',
                            background: 'var(--bg-surface-elevated)',
                            borderBottom: '1px solid var(--border-medium)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
                            <span style={{ color: '#10b981', flexShrink: 0 }}>
                              {activeEditorFile.name.toLowerCase().endsWith('.pdf') ? <IconFileText size={18} /> : <IconImage size={18} />}
                            </span>
                            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                                  {activeEditorFile.name}
                                </span>
                                <Badge variant={activeEditorFile.name.toLowerCase().endsWith('.pdf') ? 'info' : 'success'}>
                                  {activeEditorFile.name.toLowerCase().endsWith('.pdf') ? 'PDF Document' : 'Visual Preview'}
                                </Badge>
                              </div>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {activeEditorFile.path}
                              </span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {!activeEditorFile.name.toLowerCase().endsWith('.pdf') && previewBlobUrl && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'var(--bg-card)', padding: '0.2rem 0.4rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', marginRight: '0.5rem' }}>
                                <button
                                  type="button"
                                  className="btn btn-ghost"
                                  style={{ padding: '0.2rem 0.5rem', fontSize: '0.85rem' }}
                                  onClick={() => setImageZoom((z) => Math.max(0.2, +(z - 0.2).toFixed(1)))}
                                  title="Zoom out"
                                >
                                  −
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-ghost"
                                  style={{ padding: '0.2rem 0.4rem', fontSize: '0.78rem', minWidth: '45px', textAlign: 'center' }}
                                  onClick={() => setImageZoom(1)}
                                  title="Reset zoom to 100%"
                                >
                                  {Math.round(imageZoom * 100)}%
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-ghost"
                                  style={{ padding: '0.2rem 0.5rem', fontSize: '0.85rem' }}
                                  onClick={() => setImageZoom((z) => Math.min(3, +(z + 0.2).toFixed(1)))}
                                  title="Zoom in"
                                >
                                  +
                                </button>
                              </div>
                            )}

                            {activeEditorFile.name.toLowerCase().endsWith('.pdf') && previewBlobUrl && (
                              <a
                                href={previewBlobUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-outline"
                                style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', textDecoration: 'none' }}
                                title="Open PDF in a new browser tab"
                              >
                                Open in New Tab
                              </a>
                            )}

                            <Button
                              variant="primary"
                              size="sm"
                              icon={<IconDownload size={14} />}
                              onClick={(e) => handleDownloadFile(activeEditorFile, e)}
                              title="Download original file"
                            >
                              Download
                            </Button>

                            <button
                              type="button"
                              className="btn btn-ghost"
                              style={{ padding: '0.35rem', color: 'var(--text-muted)' }}
                              onClick={handleCloseEditor}
                              title="Close preview"
                            >
                              <IconClose size={18} />
                            </button>
                          </div>
                        </div>

                        {/* Preview Content Area */}
                        <div style={{ flex: 1, minHeight: '520px', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                          {previewBlobUrl && (
                            <>
                              {activeEditorFile.name.toLowerCase().endsWith('.pdf') ? (
                                <iframe
                                  src={previewBlobUrl}
                                  title={activeEditorFile.name}
                                  style={{ width: '100%', height: '100%', minHeight: '600px', border: 'none', background: '#fff' }}
                                />
                              ) : (
                                <div
                                  style={{
                                    flex: 1,
                                    minHeight: '520px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    overflow: 'auto',
                                    padding: '2rem',
                                    background: 'radial-gradient(circle, rgba(255, 255, 255, 0.05) 10%, transparent 10%) var(--bg-surface)',
                                    backgroundSize: '16px 16px',
                                  }}
                                >
                                  <img
                                    src={previewBlobUrl}
                                    alt={activeEditorFile.name}
                                    style={{
                                      maxWidth: '100%',
                                      maxHeight: '560px',
                                      transform: `scale(${imageZoom})`,
                                      transformOrigin: 'center center',
                                      transition: 'transform 0.15s ease-out',
                                      objectFit: 'contain',
                                      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45)',
                                      borderRadius: 'var(--radius-md)',
                                    }}
                                  />
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })()
                )}

                {/* 3. DOWNLOAD-ONLY (Archives, Binaries, Legacy Formats) */}
                {activeCapability === 'download-only' && (
                  (() => {
                    if (richPreviewData && richPreviewData.kind === 'unsupported') {
                      return (
                        <UnsupportedPreview
                          artifact={activeEditorFile}
                          data={richPreviewData}
                          onDownload={() => handleDownloadFile(activeEditorFile, { stopPropagation: () => {} } as any)}
                          onClose={handleCloseEditor}
                        />
                      );
                    }

                    const formatInfo = getFileFormatInfo(activeEditorFile.name, activeEditorFile.mimeType);
                    return (
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          height: '100%',
                          minHeight: '560px',
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-lg)',
                          overflow: 'hidden',
                          boxShadow: 'var(--shadow-md)',
                        }}
                      >
                        {/* Top Bar */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '0.75rem',
                            padding: '0.65rem 1rem',
                            background: 'var(--bg-surface-elevated)',
                            borderBottom: '1px solid var(--border-medium)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
                            <span style={{ color: formatInfo.iconColor, flexShrink: 0 }}>
                              <IconFileText size={18} />
                            </span>
                            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                                  {activeEditorFile.name}
                                </span>
                                <Badge variant="neutral">Download Only</Badge>
                              </div>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {activeEditorFile.path}
                              </span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Button
                              variant="primary"
                              size="sm"
                              icon={<IconDownload size={14} />}
                              onClick={(e) => handleDownloadFile(activeEditorFile, e)}
                            >
                              Download File
                            </Button>
                            <button
                              type="button"
                              className="btn btn-ghost"
                              style={{ padding: '0.35rem', color: 'var(--text-muted)' }}
                              onClick={handleCloseEditor}
                              title="Close inspection view"
                            >
                              <IconClose size={18} />
                            </button>
                          </div>
                        </div>

                        {/* Document Metadata Body */}
                        <div
                          style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '3rem 2rem',
                            textAlign: 'center',
                            background: 'var(--bg-surface)',
                          }}
                        >
                          <div
                            style={{
                              width: '72px',
                              height: '72px',
                              borderRadius: 'var(--radius-lg)',
                              background: formatInfo.iconBg,
                              color: formatInfo.iconColor,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              marginBottom: '1.25rem',
                              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
                            }}
                          >
                            <IconFileText size={38} />
                          </div>

                          <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                            {formatInfo.title}
                          </h3>

                          <p style={{ color: 'var(--text-secondary)', maxWidth: '520px', fontSize: '0.92rem', lineHeight: 1.6, marginBottom: '2rem' }}>
                            {formatInfo.desc}
                          </p>

                          {/* Technical Specification Grid */}
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                              gap: '1rem',
                              width: '100%',
                              maxWidth: '680px',
                              textAlign: 'left',
                              padding: '1.25rem',
                              background: 'var(--bg-card)',
                              border: '1px solid var(--border-subtle)',
                              borderRadius: 'var(--radius-md)',
                              marginBottom: '2rem',
                            }}
                          >
                            <div>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                File Size
                              </span>
                              <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                                {formatBytes(activeEditorFile.sizeBytes)}
                              </span>
                            </div>

                            <div>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                MIME Type
                              </span>
                              <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                {activeEditorFile.mimeType || 'application/octet-stream'}
                              </span>
                            </div>

                            <div>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                Last Updated
                              </span>
                              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                {new Date(activeEditorFile.updatedAt).toLocaleString()}
                              </span>
                            </div>

                            <div>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                SHA-256 Hash
                              </span>
                              <code style={{ fontSize: '0.75rem', color: 'var(--brand-trace-light)', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
                                {activeEditorFile.hash ? `${activeEditorFile.hash.slice(0, 16)}...` : 'Computed on storage'}
                              </code>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <Button
                              variant="primary"
                              size="lg"
                              icon={<IconDownload size={18} />}
                              onClick={(e) => handleDownloadFile(activeEditorFile, e)}
                            >
                              Download File ({formatBytes(activeEditorFile.sizeBytes)})
                            </Button>
                            <Button variant="outline" size="lg" onClick={handleCloseEditor}>
                              Back to Workspace
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })()
                )}
              </div>

              {/* Collapsible Artifact Discussions Side Panel */}
              {isCommentsOpen && activeEditorFile && (
                <div
                  style={{
                    width: '380px',
                    flexShrink: 0,
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: 'var(--radius-lg)',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    maxHeight: '750px',
                  }}
                >
                  <ArtifactCommentsPanel
                    projectId={projectId!}
                    artifactId={activeEditorFile.id}
                    artifactName={activeEditorFile.name}
                    currentCommitHash={gitStatus?.headCommitHash}
                    onClose={() => setIsCommentsOpen(false)}
                  />
                </div>
              )}
            </div>
          ) : (
            /* Standard Table View when no file is active */
            <div>
              {/* Loading Artifacts State */}
              {isLoadingArtifacts && (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  <div className="health-dot healthy" style={{ width: 10, height: 10, marginBottom: '0.75rem' }} />
                  <p style={{ fontSize: '0.9rem' }}>Loading directory contents...</p>
                </div>
              )}

              {/* Empty Directory State */}
              {!isLoadingArtifacts && filteredArtifacts.length === 0 && (
                <div
                  style={{
                    padding: '4rem 2rem',
                    textAlign: 'center',
                    background: 'var(--bg-card)',
                    border: '1px dashed var(--border-medium)',
                    borderRadius: 'var(--radius-lg)',
                    margin: '1.5rem 0',
                  }}
                >
                  <IconFolder size={36} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                    {searchFilter ? 'No Matching Files Found' : 'This Folder is Empty'}
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '420px', margin: '0 auto 1.5rem auto' }}>
                    {searchFilter
                      ? `No files or folders matched '${searchFilter}'.`
                      : 'Start adding code, datasets, documents, or models to this project workspace.'}
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
                    <Button variant="primary" size="sm" onClick={openCreateArtifactModal}>
                      Create File
                    </Button>
                    <Button variant="outline" size="sm" onClick={openCreateFolderModal}>
                      Create Folder
                    </Button>
                    <Button variant="outline" size="sm" onClick={triggerFileUpload}>
                      Upload File
                    </Button>
                  </div>
                </div>
              )}

              {/* Files & Folders Table */}
              {!isLoadingArtifacts && filteredArtifacts.length > 0 && (
                <div
                  className="card"
                  style={{
                    padding: 0,
                    overflow: 'hidden',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                    <thead>
                      <tr style={{ background: 'rgba(0, 0, 0, 0.25)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                        <th style={{ padding: '0.85rem 1.25rem', fontWeight: 600 }}>Name</th>
                        <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Type</th>
                        <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Size</th>
                        <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Modified</th>
                        <th style={{ padding: '0.85rem 1.25rem', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredArtifacts.map((item) => (
                        <tr
                          key={item.id}
                          onClick={() => {
                            if (item.type === 'folder') {
                              navigateToFolder(item.id);
                            } else {
                              handleOpenFile(item);
                            }
                          }}
                          style={{
                            borderBottom: '1px solid var(--border-subtle)',
                            cursor: 'pointer',
                            transition: 'background var(--transition-fast)',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-card-hover)')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                          <td style={{ padding: '0.85rem 1.25rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <span style={{ display: 'flex', alignItems: 'center' }}>
                                {getItemIcon(item, 18)}
                              </span>
                              <span style={{ fontWeight: item.type === 'folder' ? 600 : 400, color: 'var(--text-primary)' }}>
                                {item.name}
                              </span>
                            </div>
                          </td>

                          <td style={{ padding: '0.85rem 1rem' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                              {renderCategoryBadge(item.artifactType)}
                              {item.type === 'file' && renderCapabilityBadge(getArtifactCapability(item))}
                            </div>
                          </td>

                          <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)' }}>
                            {item.type === 'folder' ? '—' : formatBytes(item.sizeBytes)}
                          </td>

                          <td style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                            {new Date(item.updatedAt).toLocaleDateString()}
                          </td>

                          <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }} onClick={(e) => e.stopPropagation()}>
                              {item.type === 'file' && (
                                <>
                                  {getArtifactCapability(item) === 'editable' && (
                                    (() => {
                                      const ext = item.name.lastIndexOf('.') !== -1 ? item.name.slice(item.name.lastIndexOf('.')).toLowerCase() : '';
                                      if (ext === '.csv' || ext === '.tsv') {
                                        return (
                                          <>
                                            <button
                                              type="button"
                                              className="btn btn-outline"
                                              style={{
                                                padding: '0.28rem 0.6rem',
                                                fontSize: '0.78rem',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.3rem',
                                              }}
                                              title="Preview CSV table"
                                              onClick={() => {
                                                handleOpenFile(item);
                                                setCsvViewMode('table');
                                              }}
                                            >
                                              <IconTable size={13} />
                                              <span>Preview</span>
                                            </button>
                                            <button
                                              type="button"
                                              className="btn btn-outline"
                                              style={{
                                                padding: '0.28rem 0.6rem',
                                                fontSize: '0.78rem',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.3rem',
                                              }}
                                              title="Edit in code editor"
                                              onClick={() => {
                                                handleOpenFile(item);
                                                setCsvViewMode('code');
                                              }}
                                            >
                                              <IconEdit size={13} />
                                              <span>Edit</span>
                                            </button>
                                          </>
                                        );
                                      }
                                      return (
                                        <button
                                          type="button"
                                          className="btn btn-outline"
                                          style={{
                                            padding: '0.28rem 0.6rem',
                                            fontSize: '0.78rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.3rem',
                                          }}
                                          title="Open in code editor"
                                          onClick={() => handleOpenFile(item)}
                                        >
                                          <IconEdit size={13} />
                                          <span>Edit</span>
                                        </button>
                                      );
                                    })()
                                  )}
                                  {getArtifactCapability(item) === 'previewable' && (
                                    <button
                                      type="button"
                                      className="btn btn-outline"
                                      style={{
                                        padding: '0.28rem 0.6rem',
                                        fontSize: '0.78rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.3rem',
                                      }}
                                      title="Open preview"
                                      onClick={() => handleOpenFile(item)}
                                    >
                                      <IconEye size={13} />
                                      <span>Preview</span>
                                    </button>
                                  )}
                                  {getArtifactCapability(item) === 'download-only' && (
                                    <button
                                      type="button"
                                      className="btn btn-outline"
                                      style={{
                                        padding: '0.28rem 0.6rem',
                                        fontSize: '0.78rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.3rem',
                                      }}
                                      title="Inspect file details"
                                      onClick={() => handleOpenFile(item)}
                                    >
                                      <IconEye size={13} />
                                      <span>Inspect</span>
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    className="btn btn-ghost"
                                    style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem' }}
                                    title="Download file"
                                    onClick={(e) => handleDownloadFile(item, e)}
                                  >
                                    <IconDownload size={14} />
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-ghost"
                                    style={{
                                      padding: '0.3rem 0.5rem',
                                      fontSize: '0.8rem',
                                      color: 'var(--brand-primary-light, #818cf8)',
                                    }}
                                    title="View Traceability & Provenance"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openTraceabilityModal(item);
                                    }}
                                  >
                                    <IconSparkles size={14} />
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-ghost"
                                    style={{
                                      padding: '0.3rem 0.5rem',
                                      fontSize: '0.8rem',
                                      color: 'var(--text-secondary)',
                                    }}
                                    title="Discussions & Comments"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenFile(item);
                                      setIsCommentsOpen(true);
                                    }}
                                  >
                                    <IconMessageSquare size={14} />
                                  </button>
                                </>
                              )}
                              <button
                                type="button"
                                className="btn btn-ghost"
                                style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem' }}
                                title="Rename"
                                onClick={(e) => openRenameModal(item, e)}
                              >
                                <IconEdit size={14} />
                              </button>
                              <button
                                type="button"
                                className="btn btn-ghost"
                                style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem' }}
                                title="Move"
                                onClick={(e) => openMoveModal(item, e)}
                              >
                                <IconArrowRight size={14} />
                              </button>
                              <button
                                type="button"
                                className="btn btn-ghost"
                                style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem', color: 'var(--status-danger)' }}
                                title="Delete"
                                onClick={(e) => openDeleteModal(item, e)}
                              >
                                <IconTrash size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: CHANGES & SAVE VERSION */}
      {activeTab === 'changes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <ImpactAnalysisCard
            projectId={projectId!}
            hasWorkingTreeChanges={(gitStatus?.totalChangesCount || 0) > 0}
            onInspectArtifact={handleNavigateToRelatedArtifact}
          />
          <GitChangesView
            projectId={projectId!}
            status={gitStatus}
            isLoadingStatus={isLoadingGitStatus}
            onRefresh={fetchGitState}
            onOpenCommitModal={() => {
              setGitActionError(null);
              setIsCommitModalOpen(true);
            }}
            onOpenFileInEditor={handleOpenFileFromGit}
          />
        </div>
      )}

      {/* TAB 4: COMMIT HISTORY & RESTORE */}
      {activeTab === 'history' && (
        <GitHistoryView
          projectId={projectId!}
          onRestoreCommit={(commit) => {
            setGitActionError(null);
            setRestoreTargetCommit(commit);
          }}
        />
      )}

      {/* TAB: PROJECT TASKS & ISSUES */}
      {activeTab === 'tasks' && (
        <ProjectTasksTab
          projectId={projectId!}
          projectName={project?.name || 'Project'}
          artifacts={allProjectArtifacts}
        />
      )}

      {/* TAB: CODE & ARTIFACT REVIEWS */}
      {activeTab === 'reviews' && (
        <ProjectReviewsTab
          projectId={projectId!}
          projectName={project?.name || 'Project'}
          branches={gitBranches}
          artifacts={allProjectArtifacts}
        />
      )}

      {/* TAB: TEAM COLLABORATION & ROLES */}
      {activeTab === 'team' && (
        <ProjectTeamTab
          projectId={projectId!}
          projectName={project?.name || 'Project'}
        />
      )}

      {/* TAB 5: REAL PROJECT ACTIVITY TIMELINE */}
      {activeTab === 'activity' && (
        <ProjectActivityTimeline projectId={projectId!} />
      )}

      {/* CREATE FOLDER MODAL */}
      {isCreateFolderModalOpen && (
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
          onClick={() => !isSubmittingModal && setIsCreateFolderModalOpen(false)}
        >
          <div
            className="card"
            style={{
              maxWidth: '460px',
              width: '100%',
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-medium)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-header" style={{ marginBottom: '1.25rem' }}>
              <div className="card-title">
                <IconFolder size={18} />
                <span>New Folder</span>
              </div>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ padding: '0.25rem' }}
                onClick={() => setIsCreateFolderModalOpen(false)}
              >
                <IconClose size={16} />
              </button>
            </div>

            {modalError && (
              <div
                style={{
                  padding: '0.75rem',
                  marginBottom: '1rem',
                  background: 'var(--status-danger-bg)',
                  border: '1px solid var(--status-danger-border)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--status-danger)',
                  fontSize: '0.85rem',
                }}
              >
                {modalError}
              </div>
            )}

            <form onSubmit={handleCreateFolderSubmit}>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                  Folder Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. models, datasets, or src"
                  value={folderNameInput}
                  onChange={(e) => setFolderNameInput(e.target.value)}
                  maxLength={255}
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
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem', display: 'block' }}>
                  Location: {currentFolder ? currentFolder.path : '/ (Root)'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <Button type="button" variant="ghost" onClick={() => setIsCreateFolderModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" isLoading={isSubmittingModal}>
                  Create Folder
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RENAME MODAL */}
      {renameTarget && (
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
          onClick={() => !isSubmittingModal && setRenameTarget(null)}
        >
          <div
            className="card"
            style={{
              maxWidth: '460px',
              width: '100%',
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-medium)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-header" style={{ marginBottom: '1.25rem' }}>
              <div className="card-title">
                <IconEdit size={18} />
                <span>Rename {renameTarget.type === 'folder' ? 'Folder' : 'File'}</span>
              </div>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ padding: '0.25rem' }}
                onClick={() => setRenameTarget(null)}
              >
                <IconClose size={16} />
              </button>
            </div>

            {modalError && (
              <div
                style={{
                  padding: '0.75rem',
                  marginBottom: '1rem',
                  background: 'var(--status-danger-bg)',
                  border: '1px solid var(--status-danger-border)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--status-danger)',
                  fontSize: '0.85rem',
                }}
              >
                {modalError}
              </div>
            )}

            <form onSubmit={handleRenameSubmit}>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                  New Name
                </label>
                <input
                  type="text"
                  value={renameInput}
                  onChange={(e) => setRenameInput(e.target.value)}
                  maxLength={255}
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
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <Button type="button" variant="ghost" onClick={() => setRenameTarget(null)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" isLoading={isSubmittingModal}>
                  Save Name
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MOVE MODAL */}
      {moveTarget && (
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
          onClick={() => !isSubmittingModal && setMoveTarget(null)}
        >
          <div
            className="card"
            style={{
              maxWidth: '460px',
              width: '100%',
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-medium)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-header" style={{ marginBottom: '1.25rem' }}>
              <div className="card-title">
                <IconArrowRight size={18} />
                <span>Move '{moveTarget.name}'</span>
              </div>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ padding: '0.25rem' }}
                onClick={() => setMoveTarget(null)}
              >
                <IconClose size={16} />
              </button>
            </div>

            {modalError && (
              <div
                style={{
                  padding: '0.75rem',
                  marginBottom: '1rem',
                  background: 'var(--status-danger-bg)',
                  border: '1px solid var(--status-danger-border)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--status-danger)',
                  fontSize: '0.85rem',
                }}
              >
                {modalError}
              </div>
            )}

            <form onSubmit={handleMoveSubmit}>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                  Select Destination Directory
                </label>
                <select
                  value={selectedDestinationFolderId}
                  onChange={(e) => setSelectedDestinationFolderId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.9rem',
                    background: 'var(--bg-app)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                  }}
                >
                  <option value="root">/ (Root Directory)</option>
                  {allFolders
                    .filter((f) => f.id !== moveTarget.id) // Exclude self
                    .map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.path}
                      </option>
                    ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <Button type="button" variant="ghost" onClick={() => setMoveTarget(null)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" isLoading={isSubmittingModal}>
                  Move Item
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteTarget && (
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
          onClick={() => !isSubmittingModal && setDeleteTarget(null)}
        >
          <div
            className="card"
            style={{
              maxWidth: '460px',
              width: '100%',
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--status-danger-border)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-header" style={{ marginBottom: '1rem' }}>
              <div className="card-title" style={{ color: 'var(--status-danger)' }}>
                <IconTrash size={18} />
                <span>Confirm Deletion</span>
              </div>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ padding: '0.25rem' }}
                onClick={() => setDeleteTarget(null)}
              >
                <IconClose size={16} />
              </button>
            </div>

            <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.5 }}>
              Are you sure you want to delete <strong>{deleteTarget.name}</strong>?
            </p>

            {deleteTarget.type === 'folder' && (
              <div
                style={{
                  padding: '0.75rem',
                  marginBottom: '1.25rem',
                  background: 'rgba(244, 63, 94, 0.1)',
                  border: '1px solid var(--status-danger-border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.82rem',
                  color: 'var(--status-danger)',
                }}
              >
                <strong>Warning:</strong> Deleting this folder will permanently delete all nested files and subdirectories.
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <Button type="button" variant="ghost" onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <Button type="button" variant="danger" isLoading={isSubmittingModal} onClick={handleDeleteSubmit}>
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* UNSAVED CHANGES WARNING MODAL */}
      {unsavedPromptTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(8, 11, 17, 0.75)',
            backdropFilter: 'blur(8px)',
            zIndex: 150,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
          }}
          onClick={() => setUnsavedPromptTarget(null)}
        >
          <div
            className="card"
            style={{
              maxWidth: '480px',
              width: '100%',
              background: 'var(--bg-surface-elevated)',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              boxShadow: 'var(--shadow-lg)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-header" style={{ marginBottom: '1rem' }}>
              <div className="card-title" style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <IconAlertCircle size={20} />
                <span>Unsaved Changes</span>
              </div>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ padding: '0.25rem' }}
                onClick={() => setUnsavedPromptTarget(null)}
              >
                <IconClose size={16} />
              </button>
            </div>

            <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: 1.6 }}>
              You have unsaved edits in <strong style={{ color: 'var(--text-primary)' }}>{activeEditorFile?.name}</strong>.
              If you navigate away without saving, your modifications will be lost.
            </p>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setUnsavedPromptTarget(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={handleConfirmDiscardUnsaved}
              >
                Discard Edits
              </Button>
              <Button
                type="button"
                variant="primary"
                isLoading={isSavingEditorContent}
                onClick={handleSaveAndProceedUnsaved}
              >
                Save & Proceed
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* GIT REPOSITORY INITIALIZATION MODAL */}
      <GitInitModal
        isOpen={isInitModalOpen}
        projectName={project.name}
        isLoading={isGitActionLoading}
        onClose={() => setIsInitModalOpen(false)}
        onConfirm={handleInitRepository}
      />

      {/* GIT COMMIT / SAVE VERSION MODAL */}
      <GitCommitModal
        isOpen={isCommitModalOpen}
        status={gitStatus}
        isLoading={isGitActionLoading}
        errorMessage={gitActionError}
        onClose={() => {
          setGitActionError(null);
          setIsCommitModalOpen(false);
        }}
        onSubmit={handleCommitVersion}
      />

      {/* GIT BRANCH MODAL */}
      <GitBranchModal
        isOpen={isBranchModalOpen}
        status={gitStatus}
        branches={gitBranches}
        isLoading={isGitActionLoading}
        errorMessage={gitActionError}
        onClose={() => {
          setGitActionError(null);
          setIsBranchModalOpen(false);
        }}
        onSwitchBranch={handleSwitchBranch}
        onCreateBranch={handleCreateBranch}
      />

      {/* GIT RESTORE CONFIRMATION MODAL */}
      <GitRestoreModal
        isOpen={!!restoreTargetCommit}
        projectId={projectId!}
        commit={restoreTargetCommit}
        isLoading={isGitActionLoading}
        errorMessage={gitActionError}
        onClose={() => {
          setGitActionError(null);
          setRestoreTargetCommit(null);
        }}
        onConfirm={handleRestoreConfirm}
      />

      {/* GITHUB PUBLISH MODAL */}
      <GitHubPublishModal
        isOpen={isGitHubPublishModalOpen}
        projectName={project.name}
        isPublishing={isSyncingGitHub}
        error={gitHubActionError}
        onClose={() => {
          setGitHubActionError(null);
          setIsGitHubPublishModalOpen(false);
        }}
        onPublish={handlePublishGitHub}
      />

      {/* GITHUB LINK MODAL */}
      <GitHubLinkModal
        isOpen={isGitHubLinkModalOpen}
        isLinking={isSyncingGitHub}
        error={gitHubActionError}
        onClose={() => {
          setGitHubActionError(null);
          setIsGitHubLinkModalOpen(false);
        }}
        onLink={handleLinkGitHub}
      />

      {/* GITHUB PUSH MODAL */}
      <GitHubPushModal
        isOpen={isGitHubPushModalOpen}
        status={gitHubRemoteStatus}
        isPushing={isSyncingGitHub}
        error={gitHubActionError}
        onClose={() => {
          setGitHubActionError(null);
          setIsGitHubPushModalOpen(false);
        }}
        onPush={handlePushGitHub}
      />

      {/* GITHUB PULL MODAL */}
      <GitHubPullModal
        isOpen={isGitHubPullModalOpen}
        status={gitHubRemoteStatus}
        isPulling={isSyncingGitHub}
        error={gitHubActionError}
        onClose={() => {
          setGitHubActionError(null);
          setIsGitHubPullModalOpen(false);
        }}
        onPull={handlePullGitHub}
      />

      {/* GITHUB ACCOUNT MODAL */}
      <GitHubAccountModal
        isOpen={isGitHubAccountModalOpen}
        account={gitHubOAuthStatus?.account || null}
        isDisconnecting={isSyncingGitHub}
        error={gitHubActionError}
        onClose={() => {
          setGitHubActionError(null);
          setIsGitHubAccountModalOpen(false);
        }}
        onDisconnect={handleDisconnectGitHub}
      />

      {/* CREATE ARTIFACT (FILE) MODAL */}
      <CreateArtifactModal
        isOpen={isCreateArtifactModalOpen}
        onClose={() => setIsCreateArtifactModalOpen(false)}
        onCreate={handleCreateArtifactSubmit}
        isSubmitting={isSubmittingModal}
        currentFolderPath={currentFolder ? currentFolder.path : '/ (Root)'}
        existingNames={artifacts.map((a) => a.name)}
      />

      {/* ARTIFACT TRACEABILITY & PROVENANCE MODAL */}
      {isTraceabilityModalOpen && traceabilityArtifact && (
        <ArtifactTraceabilityModal
          projectId={projectId!}
          artifact={traceabilityArtifact}
          allArtifacts={allProjectArtifacts}
          isOpen={isTraceabilityModalOpen}
          onClose={() => {
            setIsTraceabilityModalOpen(false);
            setTraceabilityArtifact(null);
          }}
          onNavigateToArtifact={handleNavigateToRelatedArtifact}
        />
      )}
    </div>
  );
};

