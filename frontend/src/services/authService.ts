import { apiClient } from './apiClient';
import { ApiSuccessResponse } from '../types/api';
import { AuthUser, LoginInput, RegisterInput, LoginResponse } from '../types/auth';

/**
 * Authentication Service
 * Communicates with the backend auth endpoints:
 * - POST /api/v1/auth/register
 * - POST /api/v1/auth/login
 * - GET /api/v1/auth/me
 */
export const authService = {
  /**
   * Authenticates user with email and password.
   * Returns user profile and signed JWT access token.
   */
  async login(input: LoginInput): Promise<LoginResponse> {
    const response = await apiClient.post<ApiSuccessResponse<LoginResponse>>('/v1/auth/login', input);
    return response.data;
  },

  /**
   * Registers a new user account.
   * Returns created SafeUser profile.
   */
  async register(input: RegisterInput): Promise<AuthUser> {
    const response = await apiClient.post<ApiSuccessResponse<AuthUser>>('/v1/auth/register', input);
    return response.data;
  },

  /**
   * Fetches the currently authenticated user's profile using the active Bearer token.
   */
  async getMe(): Promise<AuthUser> {
    const response = await apiClient.get<ApiSuccessResponse<AuthUser>>('/v1/auth/me');
    return response.data;
  },
};
