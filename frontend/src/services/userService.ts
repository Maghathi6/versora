import { apiClient } from './apiClient';
import { ApiSuccessResponse } from '../types/api';
import { AuthUser, UpdateProfileInput } from '../types/auth';

/**
 * User Service
 * Communicates with backend profile endpoints:
 * - GET /api/v1/users/me (retrieve authenticated profile)
 * - PATCH /api/v1/users/me (update permitted profile fields)
 */
export const userService = {
  /**
   * Retrieves the currently authenticated user's SafeUser profile.
   */
  async getMe(): Promise<AuthUser> {
    const response = await apiClient.get<ApiSuccessResponse<AuthUser>>('/v1/users/me');
    return response.data;
  },

  /**
   * Updates the current user's profile information (displayName, username, bio).
   * Returns updated SafeUser record.
   */
  async updateMe(input: UpdateProfileInput): Promise<AuthUser> {
    const response = await apiClient.patch<ApiSuccessResponse<AuthUser>>('/v1/users/me', input);
    return response.data;
  },
};
