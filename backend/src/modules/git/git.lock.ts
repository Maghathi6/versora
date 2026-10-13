import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Per-Project Re-Entrant Concurrency Lock Manager
 * Ensures that concurrent Git operations targeting the same project repository
 * are queued and executed sequentially to prevent .git/index.lock contention
 * and repository state corruption, while allowing safe re-entrant calls within
 * the same async execution context.
 */
export class ProjectLockManager {
  private lockQueues = new Map<string, Promise<void>>();
  private activeContext = new AsyncLocalStorage<Set<string>>();

  /**
   * Executes the provided asynchronous callback exclusively for the specified projectId.
   * Re-entrant calls within the same async chain proceed without deadlocking.
   */
  async withLock<T>(projectId: string, fn: () => Promise<T>): Promise<T> {
    const heldLocks = this.activeContext.getStore();

    // Re-entrant: if current execution chain already acquired this lock, proceed directly
    if (heldLocks && heldLocks.has(projectId)) {
      return fn();
    }

    const prev = this.lockQueues.get(projectId) || Promise.resolve();

    let release: () => void;
    const taskPromise = new Promise<void>((resolve) => {
      release = resolve;
    });

    // Store task in map so subsequent concurrent callers wait for it
    this.lockQueues.set(projectId, taskPromise);

    await prev;

    const newStore = new Set(heldLocks || []);
    newStore.add(projectId);

    return this.activeContext.run(newStore, async () => {
      try {
        return await fn();
      } finally {
        release!();
        if (this.lockQueues.get(projectId) === taskPromise) {
          this.lockQueues.delete(projectId);
        }
      }
    });
  }

  /**
   * Helper to inspect if a project currently has an active lock.
   */
  isLocked(projectId: string): boolean {
    return this.lockQueues.has(projectId);
  }
}

export const projectLockManager = new ProjectLockManager();
