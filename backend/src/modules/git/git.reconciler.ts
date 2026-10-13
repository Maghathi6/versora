import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { IArtifactRepository } from '../artifacts/artifact.repository';
import { IStorageDriver } from '../../storage/storage.interface';
import {
  Artifact,
  detectArtifactType,
  resolveMimeType,
} from '../artifacts/artifact.types';

export interface ReconciliationResult {
  added: number;
  updated: number;
  removed: number;
}

interface DiskEntry {
  relPath: string; // e.g. "src/index.ts" or "src"
  fullPath: string;
  isDirectory: boolean;
  sizeBytes: number;
}

/**
 * Scans the Git working tree recursively, excluding the .git directory.
 */
async function scanWorkingTree(dir: string, baseDir = dir): Promise<DiskEntry[]> {
  const entries: DiskEntry[] = [];
  const items = await fs.promises.readdir(dir, { withFileTypes: true });

  for (const item of items) {
    if (item.name === '.git' || item.name === '.DS_Store' || item.name === 'Thumbs.db') {
      continue;
    }

    const fullPath = path.join(dir, item.name);
    const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');

    if (item.isDirectory()) {
      entries.push({
        relPath,
        fullPath,
        isDirectory: true,
        sizeBytes: 0,
      });
      const subEntries = await scanWorkingTree(fullPath, baseDir);
      entries.push(...subEntries);
    } else if (item.isFile()) {
      const stats = await fs.promises.stat(fullPath);
      entries.push({
        relPath,
        fullPath,
        isDirectory: false,
        sizeBytes: stats.size,
      });
    }
  }

  return entries;
}

/**
 * Reconciles PostgreSQL artifacts table and storage driver with the current Git working tree.
 * Ensures the database metadata matches the actual checked-out commit/branch exactly.
 */
export async function reconcileProjectArtifacts(
  projectId: string,
  repoPath: string,
  artifactRepo: IArtifactRepository,
  storage: IStorageDriver
): Promise<ReconciliationResult> {
  const diskEntries = await scanWorkingTree(repoPath);
  const existingArtifacts = await artifactRepo.findAllByProjectId(projectId);

  // Map existing artifacts by relative path without leading slash
  const artifactByRelPath = new Map<string, Artifact>();
  for (const art of existingArtifacts) {
    const normalized = art.path.startsWith('/') ? art.path.slice(1) : art.path;
    artifactByRelPath.set(normalized, art);
  }

  let added = 0;
  let updated = 0;
  let removed = 0;

  // Track parent folder IDs as they are created or verified
  // Key: relative folder path ("src" or "src/components"), Value: folder artifact ID
  const folderIdMap = new Map<string, string>();

  // 1. First reconcile directories in depth-first order
  const diskDirs = diskEntries
    .filter((e) => e.isDirectory)
    .sort((a, b) => a.relPath.split('/').length - b.relPath.split('/').length);

  for (const dir of diskDirs) {
    const parentDirRel = path.posix.dirname(dir.relPath);
    const parentId = parentDirRel === '.' || parentDirRel === '' ? null : folderIdMap.get(parentDirRel) || null;
    const folderName = path.posix.basename(dir.relPath);

    let folderArt = artifactByRelPath.get(dir.relPath);
    if (!folderArt) {
      folderArt = await artifactRepo.create({
        projectId,
        parentId,
        name: folderName,
        path: `/${dir.relPath}`,
        type: 'folder',
        artifactType: 'folder',
        mimeType: null,
        sizeBytes: 0,
        storageKey: null,
        hash: null,
      });
      added++;
    } else {
      if (folderArt.parentId !== parentId) {
        await artifactRepo.update(folderArt.id, { parentId });
        updated++;
      }
    }
    folderIdMap.set(dir.relPath, folderArt.id);
  }

  // 2. Reconcile files
  const diskFiles = diskEntries.filter((e) => !e.isDirectory);
  const seenRelPaths = new Set<string>();

  for (const file of diskFiles) {
    seenRelPaths.add(file.relPath);

    const parentDirRel = path.posix.dirname(file.relPath);
    const parentId = parentDirRel === '.' || parentDirRel === '' ? null : folderIdMap.get(parentDirRel) || null;
    const fileName = path.posix.basename(file.relPath);

    const buffer = await fs.promises.readFile(file.fullPath);
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');
    const detectedMime = resolveMimeType(fileName);
    const artifactType = detectArtifactType(fileName, false);

    let existing = artifactByRelPath.get(file.relPath);

    if (existing) {
      // Check if content or metadata changed
      const hasChanged =
        existing.hash !== hash ||
        Number(existing.sizeBytes) !== file.sizeBytes ||
        existing.parentId !== parentId;

      if (hasChanged) {
        // Update storage driver
        const storageKey = existing.storageKey || `projects/${projectId}/${crypto.randomUUID()}${path.extname(fileName)}`;
        await storage.save(storageKey, buffer, { mimeType: detectedMime });

        await artifactRepo.update(existing.id, {
          sizeBytes: file.sizeBytes,
          hash,
          parentId,
          storageKey,
          mimeType: detectedMime,
          artifactType,
        });
        updated++;
      }
    } else {
      // File newly introduced on this branch/commit
      const cleanExt = path.extname(fileName).slice(0, 16);
      const storageKey = `projects/${projectId}/${crypto.randomUUID()}${cleanExt}`;

      await storage.save(storageKey, buffer, { mimeType: detectedMime });

      await artifactRepo.create({
        projectId,
        parentId,
        name: fileName,
        path: `/${file.relPath}`,
        type: 'file',
        artifactType,
        mimeType: detectedMime,
        sizeBytes: file.sizeBytes,
        storageKey,
        hash,
      });
      added++;
    }
  }

  // Also record seen directories
  for (const dir of diskDirs) {
    seenRelPaths.add(dir.relPath);
  }

  // 3. Remove artifacts that no longer exist in the working tree
  for (const [relPath, art] of artifactByRelPath.entries()) {
    if (!seenRelPaths.has(relPath)) {
      if (art.type === 'file' && art.storageKey) {
        await storage.delete(art.storageKey).catch(() => {});
      }
      await artifactRepo.delete(art.id).catch(() => {});
      removed++;
    }
  }

  return { added, updated, removed };
}
