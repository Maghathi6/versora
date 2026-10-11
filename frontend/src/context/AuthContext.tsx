import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AuthUser, LoginInput, RegisterInput, AuthState } from '../types/auth';
import { authService } from '../services/authService';
import { authStorage } from '../utils/authStorage';
import { onUnauthorized } from '../services/apiClient';

export interface AuthContextValue extends AuthState {
  login: (input: LoginInput) => Promise<void>;
  signup: (input: RegisterInput) => Promise<AuthUser>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const logout = useCallback(() => {
    authStorage.removeToken();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const token = authStorage.getToken();
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const currentUser = await authService.getMe();
      setUser(currentUser);
    } catch {
      // Token is invalid, expired, or user not found
      authStorage.removeToken();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Session restoration on startup
  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  // Global 401 interception: clean session if an authenticated request is rejected
  useEffect(() => {
    const unsubscribe = onUnauthorized(() => {
      logout();
    });
    return unsubscribe;
  }, [logout]);

  const login = useCallback(async (input: LoginInput): Promise<void> => {
    const response = await authService.login(input);
    authStorage.setToken(response.accessToken);
    setUser(response.user);
  }, []);

  const signup = useCallback(async (input: RegisterInput): Promise<AuthUser> => {
    const createdUser = await authService.register(input);
    // Registration returns SafeUser but does not log in automatically
    return createdUser;
  }, []);

  const value: AuthContextValue = {
    user,
    isAuthenticated: Boolean(user),
    isLoading,
    login,
    signup,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
