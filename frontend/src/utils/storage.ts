/**
 * Versora Safe Storage Utilities
 * Provides resilient access to browser localStorage with in-memory fallbacks when restricted.
 */

const memoryStore: Record<string, string> = {};

export const safeStorage = {
  /**
   * Reads an item from storage with fallback support.
   */
  getItem(key: string): string | null {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch {
      // In restricted sandbox environments, use in-memory store
    }
    return memoryStore[key] ?? null;
  },

  /**
   * Sets an item in storage safely.
   */
  setItem(key: string, value: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
        return;
      }
    } catch {
      // Fallback to in-memory store
    }
    memoryStore[key] = value;
  },

  /**
   * Removes an item from storage.
   */
  removeItem(key: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
        return;
      }
    } catch {
      // Fallback
    }
    delete memoryStore[key];
  },
};
