import { IProjectRepository, projectRepository } from './project.repository';
import { ProjectResponse, toProjectResponse } from './project.types';
import {
  createProjectSchema,
  updateProjectSchema,
  projectIdParamSchema,
  CreateProjectInput,
  UpdateProjectInput,
} from './project.schemas';
import {
  ProjectValidationError,
  ProjectNotFoundError,
  ProjectForbiddenError,
  DuplicateProjectNameError,
} from './project.errors';

export interface IProjectService {
  createProject(userId: string, rawInput: unknown): Promise<ProjectResponse>;
  listProjects(userId: string): Promise<ProjectResponse[]>;
  getProject(userId: string, projectId: string): Promise<ProjectResponse>;
  updateProject(userId: string, projectId: string, rawInput: unknown): Promise<ProjectResponse>;
  deleteProject(userId: string, projectId: string): Promise<void>;
}

export class ProjectService implements IProjectService {
  private repo: IProjectRepository;

  constructor(repo: IProjectRepository = projectRepository) {
    this.repo = repo;
  }

  /**
   * Helper to validate UUID projectId route parameters.
   */
  private validateProjectId(projectId: string): string {
    const parseResult = projectIdParamSchema.safeParse({ projectId });
    if (!parseResult.success) {
      const details = parseResult.error.errors.map((err) => ({
        field: err.path.join('.') || 'projectId',
        issue: err.message,
      }));
      throw new ProjectValidationError(details);
    }
    return parseResult.data.projectId;
  }

  /**
   * Creates a new project owned exclusively by the authenticated user.
   * Client-supplied owner IDs are ignored/prohibited.
   */
  async createProject(userId: string, rawInput: unknown): Promise<ProjectResponse> {
    const parseResult = createProjectSchema.safeParse(rawInput);
    if (!parseResult.success) {
      const details = parseResult.error.errors.map((err) => ({
        field: err.path.join('.') || 'body',
        issue: err.message,
      }));
      throw new ProjectValidationError(details);
    }

    const data: CreateProjectInput = parseResult.data;
    const trimmedName = data.name.trim();

    // Enforce name uniqueness per user account
    const existing = await this.repo.findByOwnerAndName(userId, trimmedName);
    if (existing) {
      throw new DuplicateProjectNameError(trimmedName);
    }

    const project = await this.repo.create({
      name: trimmedName,
      description: data.description ? data.description.trim() : null,
      ownerId: userId,
    });

    return toProjectResponse(project);
  }

  /**
   * Lists all projects owned by the authenticated user.
   */
  async listProjects(userId: string): Promise<ProjectResponse[]> {
    const projects = await this.repo.findByOwnerId(userId);
    return projects.map(toProjectResponse);
  }

  /**
   * Retrieves a single project owned by the authenticated user.
   * Enforces strict ownership: 404 if not found, 403 if owned by another user.
   */
  async getProject(userId: string, rawProjectId: string): Promise<ProjectResponse> {
    const validProjectId = this.validateProjectId(rawProjectId);
    const project = await this.repo.findById(validProjectId);

    if (!project) {
      throw new ProjectNotFoundError(validProjectId);
    }

    if (project.ownerId !== userId) {
      throw new ProjectForbiddenError('You do not have permission to view this project.');
    }

    return toProjectResponse(project);
  }

  /**
   * Updates the name or description of an owned project.
   * Enforces strict ownership: 404 if not found, 403 if owned by another user.
   * Checks for name conflicts if the name is modified.
   */
  async updateProject(
    userId: string,
    rawProjectId: string,
    rawInput: unknown
  ): Promise<ProjectResponse> {
    const validProjectId = this.validateProjectId(rawProjectId);

    // 1. Validate update payload
    const parseResult = updateProjectSchema.safeParse(rawInput);
    if (!parseResult.success) {
      const details = parseResult.error.errors.map((err) => ({
        field: err.path.join('.') || 'body',
        issue: err.message,
      }));
      throw new ProjectValidationError(details);
    }

    // 2. Fetch existing project & verify ownership
    const project = await this.repo.findById(validProjectId);
    if (!project) {
      throw new ProjectNotFoundError(validProjectId);
    }

    if (project.ownerId !== userId) {
      throw new ProjectForbiddenError('You do not have permission to modify this project.');
    }

    const data: UpdateProjectInput = parseResult.data;

    // 3. If name is being changed, check for conflict with user's other projects
    if (data.name !== undefined) {
      const newTrimmedName = data.name.trim();
      if (newTrimmedName.toLowerCase() !== project.name.toLowerCase()) {
        const existing = await this.repo.findByOwnerAndName(userId, newTrimmedName);
        if (existing && existing.id !== validProjectId) {
          throw new DuplicateProjectNameError(newTrimmedName);
        }
      }
    }

    // 4. Perform update
    const updated = await this.repo.update(validProjectId, {
      name: data.name !== undefined ? data.name.trim() : undefined,
      description: data.description !== undefined ? data.description : undefined,
    });

    if (!updated) {
      throw new ProjectNotFoundError(validProjectId);
    }

    return toProjectResponse(updated);
  }

  /**
   * Deletes an owned project following a safe deletion policy:
   * 1. Verifies the project exists (throws 404 if missing).
   * 2. Verifies the authenticated user is the legitimate owner (throws 403 if another user's project).
   * 3. Safely executes the deletion in the database.
   */
  async deleteProject(userId: string, rawProjectId: string): Promise<void> {
    const validProjectId = this.validateProjectId(rawProjectId);

    const project = await this.repo.findById(validProjectId);
    if (!project) {
      throw new ProjectNotFoundError(validProjectId);
    }

    if (project.ownerId !== userId) {
      throw new ProjectForbiddenError('You do not have permission to delete this project.');
    }

    await this.repo.delete(validProjectId);
  }
}

export const projectService = new ProjectService();
