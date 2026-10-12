import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ProjectService } from './project.service';
import { IProjectRepository } from './project.repository';
import { Project, NewProject, UpdateProjectData } from './project.types';
import {
  ProjectValidationError,
  ProjectNotFoundError,
  ProjectForbiddenError,
  DuplicateProjectNameError,
} from './project.errors';

function createStubProjectRepository(seedProjects: Project[] = []): IProjectRepository {
  const list: Project[] = [...seedProjects];

  return {
    async create(data: NewProject): Promise<Project> {
      const newProj: Project = {
        id: `00000000-0000-0000-0000-${String(list.length + 1).padStart(12, '0')}`,
        name: data.name.trim(),
        description: data.description ? data.description.trim() : null,
        ownerId: data.ownerId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      list.push(newProj);
      return newProj;
    },
    async findById(id: string): Promise<Project | null> {
      return list.find((p) => p.id === id) || null;
    },
    async findByOwnerId(ownerId: string): Promise<Project[]> {
      return list
        .filter((p) => p.ownerId === ownerId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },
    async findByOwnerAndName(ownerId: string, name: string): Promise<Project | null> {
      const trimmed = name.trim().toLowerCase();
      return (
        list.find((p) => p.ownerId === ownerId && p.name.toLowerCase() === trimmed) || null
      );
    },
    async update(id: string, data: UpdateProjectData): Promise<Project | null> {
      const proj = list.find((p) => p.id === id);
      if (!proj) return null;
      if (data.name !== undefined) proj.name = data.name.trim();
      if (data.description !== undefined) proj.description = data.description ? data.description.trim() : null;
      proj.updatedAt = new Date();
      return proj;
    },
    async delete(id: string): Promise<boolean> {
      const index = list.findIndex((p) => p.id === id);
      if (index === -1) return false;
      list.splice(index, 1);
      return true;
    },
  };
}

describe('Project Service (ProjectService)', () => {
  const userA = '11111111-1111-1111-1111-111111111111';
  const userB = '22222222-2222-2222-2222-222222222222';

  const projectAId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const projectBId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  let stubRepo: IProjectRepository;
  let service: ProjectService;

  beforeEach(() => {
    const seed: Project[] = [
      {
        id: projectAId,
        name: 'Quantum Analysis',
        description: 'Research dataset repository',
        ownerId: userA,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      },
      {
        id: projectBId,
        name: 'Genome Classifier',
        description: 'Bioinformatics machine learning pipelines',
        ownerId: userB,
        createdAt: new Date('2026-01-02T00:00:00Z'),
        updatedAt: new Date('2026-01-02T00:00:00Z'),
      },
    ];

    stubRepo = createStubProjectRepository(seed);
    service = new ProjectService(stubRepo);
  });

  describe('createProject', () => {
    it('successfully creates a project with valid name and description for authenticated user', async () => {
      const result = await service.createProject(userA, {
        name: 'Deep Learning Model',
        description: 'PyTorch models and dataset dependencies',
      });

      assert.strictEqual(result.name, 'Deep Learning Model');
      assert.strictEqual(result.description, 'PyTorch models and dataset dependencies');
      assert.strictEqual(result.ownerId, userA);
      assert.ok(result.id);
      assert.ok(result.createdAt);
      assert.ok(result.updatedAt);
    });

    it('successfully creates a project with optional null/undefined description', async () => {
      const result = await service.createProject(userA, {
        name: 'Minimal Project',
      });

      assert.strictEqual(result.name, 'Minimal Project');
      assert.strictEqual(result.description, null);
      assert.strictEqual(result.ownerId, userA);
    });

    it('rejects duplicate project name owned by the same user with Conflict error (409)', async () => {
      await assert.rejects(
        async () => {
          await service.createProject(userA, {
            name: 'quantum analysis', // case-insensitive match
          });
        },
        (err: unknown) => {
          assert.ok(err instanceof DuplicateProjectNameError);
          assert.strictEqual(err.status, 409);
          assert.strictEqual(err.code, 'CONFLICT');
          return true;
        }
      );
    });

    it('allows two different users to create projects with the exact same name', async () => {
      const result = await service.createProject(userA, {
        name: 'Genome Classifier', // userB has this, but userA does not
      });

      assert.strictEqual(result.name, 'Genome Classifier');
      assert.strictEqual(result.ownerId, userA);
    });

    it('rejects empty project name with ProjectValidationError (400)', async () => {
      await assert.rejects(
        async () => {
          await service.createProject(userA, {
            name: '   ',
          });
        },
        (err: unknown) => {
          assert.ok(err instanceof ProjectValidationError);
          assert.strictEqual(err.status, 400);
          assert.strictEqual(err.code, 'VALIDATION_ERROR');
          return true;
        }
      );
    });

    it('rejects project name exceeding 128 characters', async () => {
      await assert.rejects(
        async () => {
          await service.createProject(userA, {
            name: 'A'.repeat(129),
          });
        },
        (err: unknown) => {
          assert.ok(err instanceof ProjectValidationError);
          return true;
        }
      );
    });

    it('rejects description exceeding 1000 characters', async () => {
      await assert.rejects(
        async () => {
          await service.createProject(userA, {
            name: 'Valid Project',
            description: 'D'.repeat(1001),
          });
        },
        (err: unknown) => {
          assert.ok(err instanceof ProjectValidationError);
          return true;
        }
      );
    });

    it('rejects unrecognized fields in payload (strict validation)', async () => {
      await assert.rejects(
        async () => {
          await service.createProject(userA, {
            name: 'Valid Project',
            ownerId: userB, // client-supplied owner attempt
          });
        },
        (err: unknown) => {
          assert.ok(err instanceof ProjectValidationError);
          return true;
        }
      );
    });
  });

  describe('listProjects', () => {
    it('returns only projects owned by the authenticated user', async () => {
      const userAProjects = await service.listProjects(userA);
      assert.strictEqual(userAProjects.length, 1);
      assert.strictEqual(userAProjects[0].id, projectAId);
      assert.strictEqual(userAProjects[0].ownerId, userA);

      const userBProjects = await service.listProjects(userB);
      assert.strictEqual(userBProjects.length, 1);
      assert.strictEqual(userBProjects[0].id, projectBId);
      assert.strictEqual(userBProjects[0].ownerId, userB);
    });

    it('returns empty array when user owns no projects', async () => {
      const nonExistentUser = '33333333-3333-3333-3333-333333333333';
      const emptyProjects = await service.listProjects(nonExistentUser);
      assert.deepStrictEqual(emptyProjects, []);
    });
  });

  describe('getProject', () => {
    it('successfully retrieves project owned by the authenticated user', async () => {
      const project = await service.getProject(userA, projectAId);
      assert.strictEqual(project.id, projectAId);
      assert.strictEqual(project.name, 'Quantum Analysis');
      assert.strictEqual(project.ownerId, userA);
    });

    it('throws ProjectNotFoundError (404) when project ID does not exist', async () => {
      const missingId = '99999999-9999-9999-9999-999999999999';
      await assert.rejects(
        async () => {
          await service.getProject(userA, missingId);
        },
        (err: unknown) => {
          assert.ok(err instanceof ProjectNotFoundError);
          assert.strictEqual(err.status, 404);
          assert.strictEqual(err.code, 'NOT_FOUND');
          return true;
        }
      );
    });

    it('throws ProjectForbiddenError (403) when user attempts to access another user\'s project', async () => {
      await assert.rejects(
        async () => {
          await service.getProject(userA, projectBId); // projectB is owned by userB
        },
        (err: unknown) => {
          assert.ok(err instanceof ProjectForbiddenError);
          assert.strictEqual(err.status, 403);
          assert.strictEqual(err.code, 'FORBIDDEN');
          return true;
        }
      );
    });

    it('throws ProjectValidationError (400) if project ID is not a valid UUID', async () => {
      await assert.rejects(
        async () => {
          await service.getProject(userA, 'not-a-uuid');
        },
        (err: unknown) => {
          assert.ok(err instanceof ProjectValidationError);
          assert.strictEqual(err.status, 400);
          return true;
        }
      );
    });
  });

  describe('updateProject', () => {
    it('successfully updates name and description of owned project', async () => {
      const updated = await service.updateProject(userA, projectAId, {
        name: 'Quantum Simulator',
        description: 'Updated research focus description',
      });

      assert.strictEqual(updated.name, 'Quantum Simulator');
      assert.strictEqual(updated.description, 'Updated research focus description');
      assert.strictEqual(updated.ownerId, userA);
    });

    it('allows updating only name', async () => {
      const updated = await service.updateProject(userA, projectAId, {
        name: 'Quantum Framework',
      });

      assert.strictEqual(updated.name, 'Quantum Framework');
      assert.strictEqual(updated.description, 'Research dataset repository');
    });

    it('allows updating only description or setting to null', async () => {
      const updated = await service.updateProject(userA, projectAId, {
        description: null,
      });

      assert.strictEqual(updated.description, null);
      assert.strictEqual(updated.name, 'Quantum Analysis');
    });

    it('allows re-submitting identical name without duplicate error', async () => {
      const updated = await service.updateProject(userA, projectAId, {
        name: 'Quantum Analysis',
      });

      assert.strictEqual(updated.name, 'Quantum Analysis');
    });

    it('rejects duplicate name if user already owns another project with that name', async () => {
      // Create a second project for userA
      await stubRepo.create({
        name: 'Second Project',
        ownerId: userA,
      });

      await assert.rejects(
        async () => {
          await service.updateProject(userA, projectAId, {
            name: 'Second Project',
          });
        },
        (err: unknown) => {
          assert.ok(err instanceof DuplicateProjectNameError);
          assert.strictEqual(err.status, 409);
          return true;
        }
      );
    });

    it('throws ProjectForbiddenError (403) when user attempts to update another user\'s project', async () => {
      await assert.rejects(
        async () => {
          await service.updateProject(userA, projectBId, {
            name: 'Hijacked Name',
          });
        },
        (err: unknown) => {
          assert.ok(err instanceof ProjectForbiddenError);
          assert.strictEqual(err.status, 403);
          return true;
        }
      );
    });

    it('throws ProjectNotFoundError (404) when project does not exist', async () => {
      const missingId = '99999999-9999-9999-9999-999999999999';
      await assert.rejects(
        async () => {
          await service.updateProject(userA, missingId, {
            name: 'Any Name',
          });
        },
        (err: unknown) => {
          assert.ok(err instanceof ProjectNotFoundError);
          assert.strictEqual(err.status, 404);
          return true;
        }
      );
    });

    it('rejects empty payload without any fields', async () => {
      await assert.rejects(
        async () => {
          await service.updateProject(userA, projectAId, {});
        },
        (err: unknown) => {
          assert.ok(err instanceof ProjectValidationError);
          assert.strictEqual(err.status, 400);
          return true;
        }
      );
    });
  });

  describe('deleteProject (safe deletion policy)', () => {
    it('successfully deletes an owned project', async () => {
      await service.deleteProject(userA, projectAId);

      const remaining = await stubRepo.findById(projectAId);
      assert.strictEqual(remaining, null);
    });

    it('throws ProjectForbiddenError (403) when attempting to delete another user\'s project', async () => {
      await assert.rejects(
        async () => {
          await service.deleteProject(userA, projectBId);
        },
        (err: unknown) => {
          assert.ok(err instanceof ProjectForbiddenError);
          assert.strictEqual(err.status, 403);
          return true;
        }
      );

      // Verify projectB was not deleted
      const existing = await stubRepo.findById(projectBId);
      assert.ok(existing);
    });

    it('throws ProjectNotFoundError (404) when project does not exist', async () => {
      const missingId = '99999999-9999-9999-9999-999999999999';
      await assert.rejects(
        async () => {
          await service.deleteProject(userA, missingId);
        },
        (err: unknown) => {
          assert.ok(err instanceof ProjectNotFoundError);
          assert.strictEqual(err.status, 404);
          return true;
        }
      );
    });
  });
});
