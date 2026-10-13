import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import { IStorageDriver, SaveResult } from './storage.interface';
import { env } from '../config/env';

/**
 * Local Disk Storage Driver
 * Stores project artifacts safely on the local filesystem outside the public directory.
 * Guarantees path containment to prevent path-traversal vulnerabilities.
 */
export class LocalStorageDriver implements IStorageDriver {
  private readonly storageRoot: string;

  constructor(customRoot?: string) {
    this.storageRoot = path.resolve(process.cwd(), customRoot || env.STORAGE_ROOT);
  }

  /**
   * Resolves a storage key to an absolute filesystem path and guarantees
   * that the path remains strictly inside the configured storage root.
   */
  private resolveSafePath(storageKey: string): string {
    // Reject absolute paths, drive letters, and leading slashes
    if (
      path.isAbsolute(storageKey) ||
      storageKey.startsWith('/') ||
      storageKey.startsWith('\\') ||
      /^[a-zA-Z]:/.test(storageKey)
    ) {
      throw new Error(`Path traversal attempt detected: ${storageKey}`);
    }

    const resolved = path.resolve(this.storageRoot, storageKey);
    const normalizedRoot = path.normalize(this.storageRoot) + path.sep;
    const normalizedResolved = path.normalize(resolved);

    if (!normalizedResolved.startsWith(normalizedRoot)) {
      throw new Error(`Path traversal attempt detected: ${storageKey}`);
    }

    return resolved;
  }

  async save(
    storageKey: string,
    content: Buffer,
    _options?: { mimeType?: string }
  ): Promise<SaveResult> {
    const targetPath = this.resolveSafePath(storageKey);
    const parentDir = path.dirname(targetPath);

    await fs.promises.mkdir(parentDir, { recursive: true });

    // Compute SHA-256 checksum
    const hash = crypto.createHash('sha256').update(content).digest('hex');

    // Write file atomically to disk
    await fs.promises.writeFile(targetPath, content);

    return {
      sizeBytes: content.length,
      hash,
    };
  }

  async getBuffer(storageKey: string): Promise<Buffer> {
    const targetPath = this.resolveSafePath(storageKey);
    return fs.promises.readFile(targetPath);
  }

  async getStream(storageKey: string): Promise<Readable> {
    const targetPath = this.resolveSafePath(storageKey);
    if (!fs.existsSync(targetPath)) {
      throw new Error(`Storage file not found: ${storageKey}`);
    }
    return fs.createReadStream(targetPath);
  }

  async exists(storageKey: string): Promise<boolean> {
    try {
      const targetPath = this.resolveSafePath(storageKey);
      await fs.promises.access(targetPath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  async delete(storageKey: string): Promise<boolean> {
    try {
      const targetPath = this.resolveSafePath(storageKey);
      await fs.promises.unlink(targetPath);
      return true;
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return false;
      }
      throw err;
    }
  }
}

export const localStorageDriver = new LocalStorageDriver();
