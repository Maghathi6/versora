import { Request, Response, NextFunction } from 'express';
import { authService, IAuthService } from './auth.service';
import { ApiSuccessResponse } from '../../types/api';
import { SafeUser } from '../users/user.types';

/**
 * Controller responsible for authentication HTTP endpoints.
 *
 * Adheres to single-responsibility and separation of concerns:
 * - Does NOT hash passwords.
 * - Does NOT query the database directly.
 * - Does NOT implement duplicate checks.
 * - Does NOT contain registration business rules.
 * All domain and business logic remains encapsulated in AuthService.
 */
export class AuthController {
  private service: IAuthService;

  constructor(service: IAuthService = authService) {
    this.service = service;
  }

  /**
   * HTTP POST handler for user registration: POST /api/v1/auth/register
   * Passes request payload to AuthService and returns 201 with SafeUser data.
   */
  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await this.service.register(req.body);

      const response: ApiSuccessResponse<SafeUser> = {
        success: true,
        data: user,
        timestamp: new Date().toISOString(),
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  };

  /**
   * HTTP POST handler for user login: POST /api/v1/auth/login
   * Passes request payload to AuthService and returns 200 with SafeUser data.
   */
  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await this.service.login(req.body);

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
}

export const authController = new AuthController();
export const registerHandler = authController.register;
export const loginHandler = authController.login;
