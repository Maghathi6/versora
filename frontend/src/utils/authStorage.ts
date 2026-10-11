/**
 * Centralized Authentication Token Storage
 * Encapsulates access-token persistence in localStorage.
 * Strictly avoids storing passwords, hashes, or full user records.
 */

const TOKEN_KEY = 'versora_access_token';

export const authStorage = {
  /**
   * Retrieves the current access token, or null if absent.
   */
  getToken(): string | null {
    try {
      if (typeof window === 'undefined') return null;
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },

  /**
   * Stores the JWT access token in browser local storage.
   */
  setToken(token: string): void {
    try {
      if (typeof window === 'undefined') return;
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      // Storage unavailable or disabled
    }
  },

  /**
   * Clears the access token from storage.
   */
  removeToken(): void {
    try {
      if (typeof window === 'undefined') return;
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      // Storage unavailable
    }
  },

  /**
   * Checks whether an access token exists in storage.
   */
  hasToken(): boolean {
    return Boolean(this.getToken());
  },
};
