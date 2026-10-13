import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { Readable } from 'node:stream';
import { gitService } from '../git/git.service';
import { intelligenceService } from '../intelligence/intelligence.service';
import { IArtifactRepository, artifactRepository, ProjectStats } from './artifact.repository';
import { IProjectRepository, projectRepository } from '../projects/project.repository';
import { IStorageDriver } from '../../storage/storage.interface';
import { localStorageDriver } from '../../storage/local.storage';
import { collaborationRepository } from '../collaboration/collaboration.repository';
import {
  Artifact,
  ArtifactResponse,
  ArtifactContentResponse,
  detectArtifactType,
  toArtifactResponse,
  isTextArtifact,
  getMonacoLanguage,
  resolveMimeType,
} from './artifact.types';
import { ArtifactPreviewResponse, generateArtifactPreview } from './artifact.preview';
import {
  createFolderSchema,
  createArtifactSchema,
  renameArtifactSchema,
  moveArtifactSchema,
  updateArtifactContentSchema,
  CreateFolderInput,
  CreateArtifactInput,
  RenameArtifactInput,
  MoveArtifactInput,
  UpdateArtifactContentInput,
} from './artifact.schemas';
import {
  ArtifactValidationError,
  ArtifactNotFoundError,
  ArtifactForbiddenError,
  DuplicateArtifactNameError,
  InvalidArtifactOperationError,
} from './artifact.errors';
import { ProjectNotFoundError, ProjectForbiddenError } from '../projects/project.errors';
import { Project } from '../projects/project.types';

export interface IArtifactService {
  createFolder(userId: string, projectId: string, rawInput: unknown): Promise<ArtifactResponse>;
  createArtifact(userId: string, projectId: string, rawInput: unknown): Promise<ArtifactResponse>;
  uploadFile(
    userId: string,
    projectId: string,
    file: { originalname: string; buffer: Buffer; mimetype?: string; size: number },
    parentId?: string | null
  ): Promise<ArtifactResponse>;
  listArtifacts(userId: string, projectId: string, parentId?: string | null): Promise<ArtifactResponse[]>;
  getArtifact(userId: string, projectId: string, artifactId: string): Promise<ArtifactResponse>;
  downloadFile(
    userId: string,
    projectId: string,
    artifactId: string
  ): Promise<{ artifact: Artifact; stream: Readable }>;
  previewFile(
    userId: string,
    projectId: string,
    artifactId: string
  ): Promise<{ artifact: Artifact; stream: Readable }>;
  getArtifactPreviewData(
    userId: string,
    projectId: string,
    artifactId: string
  ): Promise<ArtifactPreviewResponse>;
  getArtifactContent(
    userId: string,
    projectId: string,
    artifactId: string
  ): Promise<ArtifactContentResponse>;
  updateArtifactContent(
    userId: string,
    projectId: string,
    artifactId: string,
    rawInput: unknown
  ): Promise<ArtifactResponse>;
  renameArtifact(
    userId: string,
    projectId: string,
    artifactId: string,
    rawInput: unknown
  ): Promise<ArtifactResponse>;
  moveArtifact(
    userId: string,
    projectId: string,
    artifactId: string,
    rawInput: unknown
  ): Promise<ArtifactResponse>;
  deleteArtifact(
    userId: string,
    projectId: string,
    artifactId: string
  ): Promise<{ deletedIds: string[]; message: string }>;
  getProjectOverview(
    userId: string,
    projectId: string
  ): Promise<{ project: Project; stats: ProjectStats }>;
}

export class ArtifactService implements IArtifactService {
  private artifactRepo: IArtifactRepository;
  private projRepo: IProjectRepository;
  private storage: IStorageDriver;

  constructor(
    artifactRepo: IArtifactRepository = artifactRepository,
    projRepo: IProjectRepository = projectRepository,
    storage: IStorageDriver = localStorageDriver
  ) {
    this.artifactRepo = artifactRepo;
    this.projRepo = projRepo;
    this.storage = storage;
  }

  /**
   * Helper to verify project existence and authenticated user ownership.
   */
  private async verifyProjectOwnership(userId: string, projectId: string): Promise<Project> {
    const project = await this.projRepo.findById(projectId);
    if (!project) {
      throw new ProjectNotFoundError(projectId);
    }
    if (project.ownerId !== userId) {
      const member = await collaborationRepository.findMember(projectId, userId);
      if (!member) {
        throw new ProjectForbiddenError('You do not have permission to access artifacts in this project.');
      }
    }
    return project;
  }

  /**
   * Helper to synchronize file mutations with the Git working tree if initialized.
   */
  private async syncToGitWorkingTree(
    projectId: string,
    action: 'write' | 'rename' | 'move' | 'delete',
    data: {
      relPath?: string;
      buffer?: Buffer;
      oldRelPath?: string;
      newRelPath?: string;
    }
  ): Promise<void> {
    try {
      if (!gitService.isRepoInitialized(projectId)) {
        return;
      }
      const repoPath = gitService.getProjectRepoPath(projectId);

      if (action === 'write' && data.relPath && data.buffer) {
        const cleanRel = data.relPath.startsWith('/') ? data.relPath.slice(1) : data.relPath;
        const targetPath = path.join(repoPath, cleanRel);
        await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
        await fs.promises.writeFile(targetPath, data.buffer);
      } else if ((action === 'rename' || action === 'move') && data.oldRelPath && data.newRelPath) {
        const cleanOld = data.oldRelPath.startsWith('/') ? data.oldRelPath.slice(1) : data.oldRelPath;
        const cleanNew = data.newRelPath.startsWith('/') ? data.newRelPath.slice(1) : data.newRelPath;
        const oldPath = path.join(repoPath, cleanOld);
        const newPath = path.join(repoPath, cleanNew);
        if (fs.existsSync(oldPath)) {
          await fs.promises.mkdir(path.dirname(newPath), { recursive: true });
          await fs.promises.rename(oldPath, newPath);
        }
      } else if (action === 'delete' && data.relPath) {
        const cleanRel = data.relPath.startsWith('/') ? data.relPath.slice(1) : data.relPath;
        const targetPath = path.join(repoPath, cleanRel);
        if (fs.existsSync(targetPath)) {
          await fs.promises.rm(targetPath, { recursive: true, force: true });
        }
      }
    } catch {
      // Non-blocking sync to keep primary operations resilient
    }
  }

  /**
   * Creates a folder within a project.
   */
  async createFolder(userId: string, projectId: string, rawInput: unknown): Promise<ArtifactResponse> {
    await this.verifyProjectOwnership(userId, projectId);

    const parseResult = createFolderSchema.safeParse(rawInput);
    if (!parseResult.success) {
      const details = parseResult.error.errors.map((err) => ({
        field: err.path.join('.') || 'body',
        issue: err.message,
      }));
      throw new ArtifactValidationError(details);
    }

    const data: CreateFolderInput = parseResult.data;
    const folderName = data.name.trim();
    const parentId = data.parentId || null;

    let parentPath = '';
    if (parentId) {
      const parent = await this.artifactRepo.findById(parentId);
      if (!parent || parent.projectId !== projectId) {
        throw new ArtifactNotFoundError(`Parent folder '${parentId}' was not found in this project.`);
      }
      if (parent.type !== 'folder') {
        throw new InvalidArtifactOperationError(`Target parent '${parentId}' is not a directory.`);
      }
      parentPath = parent.path;
    }

    // Name collision check
    const existing = await this.artifactRepo.findByProjectAndName(projectId, parentId, folderName);
    if (existing) {
      throw new DuplicateArtifactNameError(folderName, parentPath ? `folder '${parentPath}'` : 'root directory');
    }

    const folderPath = `${parentPath}/${folderName}`;

    const folder = await this.artifactRepo.create({
      projectId,
      parentId,
      name: folderName,
      path: folderPath,
      type: 'folder',
      artifactType: 'folder',
      mimeType: null,
      sizeBytes: 0,
      storageKey: null,
      hash: null,
    });

    await intelligenceService.recordActivity(
      projectId,
      userId,
      'artifact.created',
      'artifact',
      folder.id,
      `Created folder '${folder.name}' (${folder.path})`,
      { artifactId: folder.id, path: folder.path }
    );

    return toArtifactResponse(folder);
  }

  /**
   * Creates a new persisted file artifact with empty or initial content.
   */
  async createArtifact(userId: string, projectId: string, rawInput: unknown): Promise<ArtifactResponse> {
    await this.verifyProjectOwnership(userId, projectId);

    const parseResult = createArtifactSchema.safeParse(rawInput);
    if (!parseResult.success) {
      const details = parseResult.error.errors.map((err) => ({
        field: err.path.join('.') || 'body',
        issue: err.message,
      }));
      throw new ArtifactValidationError(details);
    }

    const data: CreateArtifactInput = parseResult.data;
    const artifactName = data.name.trim();
    const parentId = data.parentId || null;
    const initialContent = data.content ?? '';

    let parentPath = '';
    if (parentId) {
      const parent = await this.artifactRepo.findById(parentId);
      if (!parent || parent.projectId !== projectId) {
        throw new ArtifactNotFoundError(`Parent folder '${parentId}' was not found in this project.`);
      }
      if (parent.type !== 'folder') {
        throw new InvalidArtifactOperationError(`Target parent '${parentId}' is not a directory.`);
      }
      parentPath = parent.path;
    }

    // Check for duplicate filename within the target parent directory
    const existing = await this.artifactRepo.findByProjectAndName(projectId, parentId, artifactName);
    if (existing) {
      throw new DuplicateArtifactNameError(artifactName, parentPath ? `folder '${parentPath}'` : 'root directory');
    }

    const buffer = Buffer.from(initialContent, 'utf-8');
    if (buffer.length > 50 * 1024 * 1024) {
      throw new ArtifactValidationError([{ field: 'content', issue: 'Initial content exceeds the 50MB file size limit.' }]);
    }

    const detectedMime = resolveMimeType(artifactName, null);
    const filePath = `${parentPath}/${artifactName}`;
    const artifactType = detectArtifactType(artifactName, false);

    // Generate isolated server-side storage key
    const uniqueId = crypto.randomUUID();
    const cleanExt = path.extname(artifactName).slice(0, 16);
    const storageKey = `projects/${projectId}/${uniqueId}${cleanExt}`;

    // 1. Persist initial content to storage driver
    const saveResult = await this.storage.save(storageKey, buffer, {
      mimeType: detectedMime,
    });

    // 2. Insert metadata into database with partial failure cleanup
    let createdArtifact: Artifact;
    try {
      createdArtifact = await this.artifactRepo.create({
        projectId,
        parentId,
        name: artifactName,
        path: filePath,
        type: 'file',
        artifactType,
        mimeType: detectedMime,
        sizeBytes: saveResult.sizeBytes,
        storageKey,
        hash: saveResult.hash,
      });
    } catch (dbError) {
      await this.storage.delete(storageKey).catch(() => {});
      throw dbError;
    }

    // 3. Sync with Git working tree if repository is initialized
    await this.syncToGitWorkingTree(projectId, 'write', {
      relPath: filePath,
      buffer,
    });

    // 4. Record project audit activity
    await intelligenceService.recordActivity(
      projectId,
      userId,
      'artifact.created',
      'artifact',
      createdArtifact.id,
      `Created file '${createdArtifact.name}' (${createdArtifact.path})`,
      { artifactId: createdArtifact.id, path: createdArtifact.path, sizeBytes: createdArtifact.sizeBytes }
    );

    return toArtifactResponse(createdArtifact);
  }

  /**
   * Uploads and persists a file to the storage driver and records metadata in PostgreSQL.
   */
  async uploadFile(
    userId: string,
    projectId: string,
    file: { originalname: string; buffer: Buffer; mimetype?: string; size: number },
    parentId?: string | null
  ): Promise<ArtifactResponse> {
    await this.verifyProjectOwnership(userId, projectId);

    if (!file || !file.buffer) {
      throw new ArtifactValidationError([{ field: 'file', issue: 'No file data received in upload payload.' }]);
    }

    // Sanitize filename
    const rawName = path.basename(file.originalname).trim();
    if (!rawName || rawName === '.' || rawName === '..') {
      throw new ArtifactValidationError([{ field: 'file', issue: 'Invalid or missing file name.' }]);
    }

    const normalizedParentId = parentId && parentId !== 'null' && parentId.trim() ? parentId.trim() : null;
    let parentPath = '';

    if (normalizedParentId) {
      const parent = await this.artifactRepo.findById(normalizedParentId);
      if (!parent || parent.projectId !== projectId) {
        throw new ArtifactNotFoundError(`Parent folder '${normalizedParentId}' was not found in this project.`);
      }
      if (parent.type !== 'folder') {
        throw new InvalidArtifactOperationError(`Target parent '${normalizedParentId}' is not a directory.`);
      }
      parentPath = parent.path;
    }

    // Enforce filename collision rule in current folder
    const existing = await this.artifactRepo.findByProjectAndName(projectId, normalizedParentId, rawName);
    if (existing) {
      throw new DuplicateArtifactNameError(rawName, parentPath ? `folder '${parentPath}'` : 'root directory');
    }

    // Generate safe storage key
    const uniqueId = crypto.randomUUID();
    const cleanExt = path.extname(rawName).slice(0, 16);
    const storageKey = `projects/${projectId}/${uniqueId}${cleanExt}`;

    // 1. Persist file content to storage driver
    const detectedMime = resolveMimeType(rawName, file.mimetype);
    const saveResult = await this.storage.save(storageKey, file.buffer, {
      mimeType: detectedMime,
    });

    const filePath = `${parentPath}/${rawName}`;
    const artifactType = detectArtifactType(rawName, false);

    // 2. Insert metadata into database with partial failure cleanup
    let createdArtifact: Artifact;
    try {
      createdArtifact = await this.artifactRepo.create({
        projectId,
        parentId: normalizedParentId,
        name: rawName,
        path: filePath,
        type: 'file',
        artifactType,
        mimeType: detectedMime,
        sizeBytes: saveResult.sizeBytes,
        storageKey,
        hash: saveResult.hash,
      });
    } catch (dbError) {
      // Roll back storage on DB insertion failure
      await this.storage.delete(storageKey).catch(() => {});
      throw dbError;
    }

    // Sync with Git working tree if repo is initialized
    await this.syncToGitWorkingTree(projectId, 'write', {
      relPath: filePath,
      buffer: file.buffer,
    });

    await intelligenceService.recordActivity(
      projectId,
      userId,
      'artifact.uploaded',
      'artifact',
      createdArtifact.id,
      `Uploaded file '${createdArtifact.name}' (${createdArtifact.path})`,
      { artifactId: createdArtifact.id, path: createdArtifact.path, sizeBytes: createdArtifact.sizeBytes }
    );

    return toArtifactResponse(createdArtifact);
  }

  /**
   * Lists artifacts in a project, optionally scoped to a parent folder.
   */
  async listArtifacts(userId: string, projectId: string, parentId?: string | null): Promise<ArtifactResponse[]> {
    await this.verifyProjectOwnership(userId, projectId);

    const normalizedParentId = parentId && parentId !== 'null' && parentId.trim() ? parentId.trim() : null;

    if (normalizedParentId) {
      const parent = await this.artifactRepo.findById(normalizedParentId);
      if (!parent || parent.projectId !== projectId) {
        throw new ArtifactNotFoundError(`Folder '${normalizedParentId}' was not found.`);
      }
    }

    const items = await this.artifactRepo.findByProjectAndParent(projectId, normalizedParentId);
    return items.map(toArtifactResponse);
  }

  /**
   * Retrieves single artifact metadata by ID.
   */
  async getArtifact(userId: string, projectId: string, artifactId: string): Promise<ArtifactResponse> {
    await this.verifyProjectOwnership(userId, projectId);

    const artifact = await this.artifactRepo.findById(artifactId);
    if (!artifact || artifact.projectId !== projectId) {
      throw new ArtifactNotFoundError(artifactId);
    }

    return toArtifactResponse(artifact);
  }

  /**
   * Downloads file content as a stream with authenticated verification.
   */
  async downloadFile(
    userId: string,
    projectId: string,
    artifactId: string
  ): Promise<{ artifact: Artifact; stream: Readable }> {
    await this.verifyProjectOwnership(userId, projectId);

    const artifact = await this.artifactRepo.findById(artifactId);
    if (!artifact || artifact.projectId !== projectId) {
      throw new ArtifactNotFoundError(artifactId);
    }

    if (artifact.type !== 'file') {
      throw new InvalidArtifactOperationError('Folders cannot be downloaded directly as file streams.');
    }

    if (!artifact.storageKey) {
      throw new ArtifactNotFoundError('File storage reference is missing.');
    }

    const exists = await this.storage.exists(artifact.storageKey);
    if (!exists) {
      throw new ArtifactNotFoundError('File content is not present in storage.');
    }

    const stream = await this.storage.getStream(artifact.storageKey);
    return { artifact, stream };
  }

  /**
   * Retrieves an artifact's stream for in-browser visual preview (images, PDF).
   */
  async previewFile(
    userId: string,
    projectId: string,
    artifactId: string
  ): Promise<{ artifact: Artifact; stream: Readable }> {
    return this.downloadFile(userId, projectId, artifactId);
  }

  /**
   * Generates structured rich preview data for project artifacts (DOCX, XLSX, PPTX, CSV, media).
   * Reuses the existing storage driver buffer without duplicate storage copies.
   */
  async getArtifactPreviewData(
    userId: string,
    projectId: string,
    artifactId: string
  ): Promise<ArtifactPreviewResponse> {
    await this.verifyProjectOwnership(userId, projectId);

    const artifact = await this.artifactRepo.findById(artifactId);
    if (!artifact || artifact.projectId !== projectId) {
      throw new ArtifactNotFoundError(artifactId);
    }

    if (artifact.type !== 'file') {
      throw new InvalidArtifactOperationError('Folders do not have file previews.');
    }

    if (!artifact.storageKey) {
      throw new ArtifactNotFoundError('File storage reference is missing.');
    }

    const exists = await this.storage.exists(artifact.storageKey);
    if (!exists) {
      throw new ArtifactNotFoundError('File content is not present in storage.');
    }

    const buffer = await this.storage.getBuffer(artifact.storageKey);
    const preview = await generateArtifactPreview(artifact.name, buffer, artifact.mimeType);

    return {
      artifact: toArtifactResponse(artifact),
      preview,
    };
  }

  /**
   * Reads text content of an artifact for the in-browser code editor.
   */
  async getArtifactContent(
    userId: string,
    projectId: string,
    artifactId: string
  ): Promise<ArtifactContentResponse> {
    await this.verifyProjectOwnership(userId, projectId);

    const artifact = await this.artifactRepo.findById(artifactId);
    if (!artifact || artifact.projectId !== projectId) {
      throw new ArtifactNotFoundError(artifactId);
    }

    if (artifact.type !== 'file') {
      throw new InvalidArtifactOperationError('Folders cannot be opened in the code editor.');
    }

    if (!artifact.storageKey) {
      throw new ArtifactNotFoundError('File storage reference is missing.');
    }

    // Fast check by extension / MIME type
    if (!isTextArtifact(artifact.name, artifact.mimeType)) {
      throw new InvalidArtifactOperationError('Binary files cannot be opened in the code editor.');
    }

    // Safety check: limit text files to 5MB for browser editing
    const MAX_TEXT_FILE_SIZE = 5 * 1024 * 1024;
    if (Number(artifact.sizeBytes) > MAX_TEXT_FILE_SIZE) {
      throw new InvalidArtifactOperationError('File is too large to open in the code editor (exceeds 5MB limit).');
    }

    const exists = await this.storage.exists(artifact.storageKey);
    if (!exists) {
      throw new ArtifactNotFoundError('File content is not present in storage.');
    }

    const buffer = await this.storage.getBuffer(artifact.storageKey);

    // Deep check for binary null bytes
    if (!isTextArtifact(artifact.name, artifact.mimeType, buffer)) {
      throw new InvalidArtifactOperationError('Binary files cannot be opened in the code editor.');
    }

    const content = buffer.toString('utf-8');
    const language = getMonacoLanguage(artifact.name);

    return {
      artifact: toArtifactResponse(artifact),
      content,
      language,
      isBinary: false,
    };
  }

  /**
   * Updates text content of an artifact from the in-browser code editor.
   */
  async updateArtifactContent(
    userId: string,
    projectId: string,
    artifactId: string,
    rawInput: unknown
  ): Promise<ArtifactResponse> {
    await this.verifyProjectOwnership(userId, projectId);

    const parseResult = updateArtifactContentSchema.safeParse(rawInput);
    if (!parseResult.success) {
      const details = parseResult.error.errors.map((err) => ({
        field: err.path.join('.') || 'body',
        issue: err.message,
      }));
      throw new ArtifactValidationError(details);
    }

    const artifact = await this.artifactRepo.findById(artifactId);
    if (!artifact || artifact.projectId !== projectId) {
      throw new ArtifactNotFoundError(artifactId);
    }

    if (artifact.type !== 'file') {
      throw new InvalidArtifactOperationError('Folders cannot be modified as text files.');
    }

    if (!artifact.storageKey) {
      throw new ArtifactNotFoundError('File storage reference is missing.');
    }

    if (!isTextArtifact(artifact.name, artifact.mimeType)) {
      throw new InvalidArtifactOperationError('Binary files cannot be modified through the code editor.');
    }

    const data: UpdateArtifactContentInput = parseResult.data;
    const contentBuffer = Buffer.from(data.content, 'utf-8');

    // 1. Write updated content to storage
    const saveResult = await this.storage.save(artifact.storageKey, contentBuffer, {
      mimeType: artifact.mimeType || 'text/plain',
    });

    // 2. Update database record (size, hash, updatedAt)
    const updated = await this.artifactRepo.update(artifactId, {
      sizeBytes: saveResult.sizeBytes,
      hash: saveResult.hash,
    });

    if (!updated) {
      throw new ArtifactNotFoundError(artifactId);
    }

    // Sync updated content with Git working tree if repo is initialized
    await this.syncToGitWorkingTree(projectId, 'write', {
      relPath: artifact.path,
      buffer: contentBuffer,
    });

    await intelligenceService.recordActivity(
      projectId,
      userId,
      'artifact.edited',
      'artifact',
      updated.id,
      `Edited file '${updated.name}' (${updated.path})`,
      { artifactId: updated.id, path: updated.path, sizeBytes: updated.sizeBytes }
    );

    return toArtifactResponse(updated);
  }

  /**
   * Renames a file or folder and cascades path updates to child artifacts.
   */
  async renameArtifact(
    userId: string,
    projectId: string,
    artifactId: string,
    rawInput: unknown
  ): Promise<ArtifactResponse> {
    await this.verifyProjectOwnership(userId, projectId);

    const parseResult = renameArtifactSchema.safeParse(rawInput);
    if (!parseResult.success) {
      const details = parseResult.error.errors.map((err) => ({
        field: err.path.join('.') || 'body',
        issue: err.message,
      }));
      throw new ArtifactValidationError(details);
    }

    const data: RenameArtifactInput = parseResult.data;
    const newName = data.name.trim();

    const artifact = await this.artifactRepo.findById(artifactId);
    if (!artifact || artifact.projectId !== projectId) {
      throw new ArtifactNotFoundError(artifactId);
    }

    if (artifact.name === newName) {
      return toArtifactResponse(artifact);
    }

    // Name collision check
    const existing = await this.artifactRepo.findByProjectAndName(projectId, artifact.parentId, newName);
    if (existing && existing.id !== artifactId) {
      throw new DuplicateArtifactNameError(newName);
    }

    const oldPath = artifact.path;
    const parentDir = path.posix.dirname(oldPath);
    const newPath = parentDir === '/' || parentDir === '.' ? `/${newName}` : `${parentDir}/${newName}`;

    const newArtifactType = artifact.type === 'folder' ? 'folder' : detectArtifactType(newName, false);

    // Update the artifact
    const updated = await this.artifactRepo.update(artifactId, {
      name: newName,
      path: newPath,
      artifactType: newArtifactType,
    });

    if (!updated) {
      throw new ArtifactNotFoundError(artifactId);
    }

    // If a folder was renamed, update paths for all descendants
    if (artifact.type === 'folder') {
      const descendants = await this.artifactRepo.findDescendants(artifactId);
      for (const desc of descendants) {
        if (desc.path.startsWith(oldPath)) {
          const updatedChildPath = `${newPath}${desc.path.slice(oldPath.length)}`;
          await this.artifactRepo.update(desc.id, { path: updatedChildPath });
        }
      }
    }

    // Sync rename with Git working tree
    await this.syncToGitWorkingTree(projectId, 'rename', {
      oldRelPath: oldPath,
      newRelPath: newPath,
    });

    await intelligenceService.recordActivity(
      projectId,
      userId,
      'artifact.renamed',
      'artifact',
      updated.id,
      `Renamed '${artifact.name}' to '${updated.name}'`,
      { artifactId: updated.id, oldPath, newPath: updated.path }
    );

    return toArtifactResponse(updated);
  }

  /**
   * Moves a file or folder into a new parent folder.
   * Prevents cyclic moves (moving a folder into itself or its descendants).
   */
  async moveArtifact(
    userId: string,
    projectId: string,
    artifactId: string,
    rawInput: unknown
  ): Promise<ArtifactResponse> {
    await this.verifyProjectOwnership(userId, projectId);

    const parseResult = moveArtifactSchema.safeParse(rawInput);
    if (!parseResult.success) {
      const details = parseResult.error.errors.map((err) => ({
        field: err.path.join('.') || 'body',
        issue: err.message,
      }));
      throw new ArtifactValidationError(details);
    }

    const data: MoveArtifactInput = parseResult.data;
    const targetParentId = data.targetParentId || null;

    const artifact = await this.artifactRepo.findById(artifactId);
    if (!artifact || artifact.projectId !== projectId) {
      throw new ArtifactNotFoundError(artifactId);
    }

    if (artifact.parentId === targetParentId) {
      return toArtifactResponse(artifact);
    }

    let targetParentPath = '';
    if (targetParentId) {
      if (targetParentId === artifact.id) {
        throw new InvalidArtifactOperationError('Cannot move a folder into itself.');
      }

      const targetParent = await this.artifactRepo.findById(targetParentId);
      if (!targetParent || targetParent.projectId !== projectId) {
        throw new ArtifactNotFoundError(`Destination folder '${targetParentId}' was not found.`);
      }
      if (targetParent.type !== 'folder') {
        throw new InvalidArtifactOperationError('Destination is not a folder.');
      }
      targetParentPath = targetParent.path;

      // Prevent cyclic containment if moving a folder
      if (artifact.type === 'folder') {
        const descendants = await this.artifactRepo.findDescendants(artifactId);
        const isDescendant = descendants.some((d) => d.id === targetParentId);
        if (isDescendant) {
          throw new InvalidArtifactOperationError('Cannot move a folder into one of its own subdirectories.');
        }
      }
    }

    // Name collision check in target folder
    const existing = await this.artifactRepo.findByProjectAndName(projectId, targetParentId, artifact.name);
    if (existing && existing.id !== artifactId) {
      throw new DuplicateArtifactNameError(artifact.name, targetParentPath ? `folder '${targetParentPath}'` : 'root directory');
    }

    const oldPath = artifact.path;
    const newPath = `${targetParentPath}/${artifact.name}`;

    const updated = await this.artifactRepo.update(artifactId, {
      parentId: targetParentId,
      path: newPath,
    });

    if (!updated) {
      throw new ArtifactNotFoundError(artifactId);
    }

    // Cascade path updates to all children if moving a folder
    if (artifact.type === 'folder') {
      const descendants = await this.artifactRepo.findDescendants(artifactId);
      for (const desc of descendants) {
        if (desc.path.startsWith(oldPath)) {
          const updatedChildPath = `${newPath}${desc.path.slice(oldPath.length)}`;
          await this.artifactRepo.update(desc.id, { path: updatedChildPath });
        }
      }
    }

    // Sync move with Git working tree
    await this.syncToGitWorkingTree(projectId, 'move', {
      oldRelPath: oldPath,
      newRelPath: newPath,
    });

    await intelligenceService.recordActivity(
      projectId,
      userId,
      'artifact.moved',
      'artifact',
      updated.id,
      `Moved '${updated.name}' from '${oldPath}' to '${updated.path}'`,
      { artifactId: updated.id, oldPath, newPath: updated.path }
    );

    return toArtifactResponse(updated);
  }

  /**
   * Deletes an artifact. If a folder, recursively deletes all descendant files from storage and database.
   */
  async deleteArtifact(
    userId: string,
    projectId: string,
    artifactId: string
  ): Promise<{ deletedIds: string[]; message: string }> {
    await this.verifyProjectOwnership(userId, projectId);

    const artifact = await this.artifactRepo.findById(artifactId);
    if (!artifact || artifact.projectId !== projectId) {
      throw new ArtifactNotFoundError(artifactId);
    }

    const deletedIds: string[] = [artifactId];

    if (artifact.type === 'file') {
      // Delete file bytes from storage driver
      if (artifact.storageKey) {
        await this.storage.delete(artifact.storageKey).catch(() => {});
      }
      await this.artifactRepo.delete(artifactId);
    } else {
      // Folder deletion: gather all descendants
      const descendants = await this.artifactRepo.findDescendants(artifactId);

      // Clean up all descendant file storage keys from disk
      for (const desc of descendants) {
        deletedIds.push(desc.id);
        if (desc.type === 'file' && desc.storageKey) {
          await this.storage.delete(desc.storageKey).catch(() => {});
        }
      }

      // Foreign key CASCADE in PostgreSQL will automatically delete all children,
      // but deleting the root folder triggers the entire cascade cleanly.
      await this.artifactRepo.delete(artifactId);
    }

    // Sync deletion with Git working tree
    await this.syncToGitWorkingTree(projectId, 'delete', {
      relPath: artifact.path,
    });

    await intelligenceService.recordActivity(
      projectId,
      userId,
      'artifact.deleted',
      'artifact',
      artifactId,
      `Deleted ${artifact.type === 'folder' ? 'folder' : 'file'} '${artifact.name}' (${artifact.path})`,
      { artifactId, path: artifact.path, type: artifact.type }
    );

    return {
      deletedIds,
      message: `${artifact.type === 'folder' ? 'Folder' : 'File'} '${artifact.name}' successfully deleted.`,
    };
  }

  /**
   * Retrieves summary statistics and project information for the workspace overview.
   */
  async getProjectOverview(
    userId: string,
    projectId: string
  ): Promise<{ project: Project; stats: ProjectStats }> {
    const project = await this.verifyProjectOwnership(userId, projectId);
    const stats = await this.artifactRepo.getStatsByProject(projectId);

    return { project, stats };
  }
}

export const artifactService = new ArtifactService();
