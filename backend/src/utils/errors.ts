/**
 * @copyright 2026 MK-TS-04
 * @project SmartMenu BE
 * @license Apache-2.0
 */

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const createBadRequestError = (message: string) =>
  new AppError(message, 400);
export const createUnauthorizedError = (message: string) =>
  new AppError(message, 401);
export const createForbiddenError = (message: string) =>
  new AppError(message, 403);
export const createNotFoundError = (message: string) =>
  new AppError(message, 404);
export const createConflictError = (message: string) =>
  new AppError(message, 409);
export const createInternalError = (message: string) =>
  new AppError(message, 500);
