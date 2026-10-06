import { Request, Response, NextFunction } from 'express';
import { authService, IAuthService, AuthResult } from './auth.service';
import { ApiSuccessResponse } from '../../types/api';
import { SafeUser } from '../users/user.types';
import { UnauthorizedError } from './auth.errors';

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
   * Passes request payload to AuthService and returns 200 with AuthResult (user + accessToken).
   */
  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authResult = await this.service.login(req.body);

      const response: ApiSuccessResponse<AuthResult> = {
        success: true,
        data: authResult,
        timestamp: new Date().toISOString(),
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  /**
   * HTTP GET handler for retrieving current authenticated user: GET /api/v1/auth/me
   * Reads req.user populated by auth middleware and returns HTTP 200 with SafeUser.
   */
  me = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication token is invalid or missing.');
      }

      const response: ApiSuccessResponse<SafeUser> = {
        success: true,
        data: req.user,
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
export const meHandler = authController.me;
