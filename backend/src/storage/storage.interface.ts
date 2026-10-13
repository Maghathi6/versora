import { Readable } from 'node:stream';

/**
 * Storage Abstraction Driver Interface
 * Enables pluggable storage drivers (e.g. LocalStorageDriver, Cloudflare R2 / S3StorageDriver).
 */
export interface SaveResult {
  sizeBytes: number;
  hash: string;
}

export interface IStorageDriver {
  /**
   * Persists file data to the underlying storage provider.
   */
  save(
    storageKey: string,
    content: Buffer,
    options?: { mimeType?: string }
  ): Promise<SaveResult>;

  /**
   * Retrieves file content as a Buffer.
   */
  getBuffer(storageKey: string): Promise<Buffer>;

  /**
   * Retrieves file content as a readable stream.
   */
  getStream(storageKey: string): Promise<Readable>;

  /**
   * Checks whether a file exists at the given storage key.
   */
  exists(storageKey: string): Promise<boolean>;

  /**
   * Deletes a file from storage.
   */
  delete(storageKey: string): Promise<boolean>;
}
