import { Request, Response, NextFunction } from 'express';
import { IUserService, userService } from './user.service';
import { ApiSuccessResponse } from '../../types/api';
import { SafeUser } from './user.types';
import { UnauthorizedError } from '../auth/auth.errors';

/**
 * Controller responsible for authenticated user profile endpoints.
 */
export class UserController {
  private service: IUserService;

  constructor(service: IUserService = userService) {
    this.service = service;
  }

  /**
   * HTTP GET handler for retrieving current user profile: GET /api/v1/users/me
   */
  getMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new UnauthorizedError('Authentication token is invalid or missing.');
      }

      const user = await this.service.getProfile(userId);

      const response: ApiSuccessResponse<SafeUser> = {
        success: true,
        data: user,
        timestamp: new Date().toISOString(),
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  /**
   * HTTP PATCH handler for updating current user profile: PATCH /api/v1/users/me
   */
  patchMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new UnauthorizedError('Authentication token is invalid or missing.');
      }

      const updatedUser = await this.service.updateProfile(userId, req.body);

      const response: ApiSuccessResponse<SafeUser> = {
        success: true,
        data: updatedUser,
        timestamp: new Date().toISOString(),
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };
}

export const userController = new UserController();
export const getMeHandler = userController.getMe;
export const patchMeHandler = userController.patchMe;
