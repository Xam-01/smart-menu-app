/**
 * @copyright 2026 MK-TS-04
 * @project SmartMenu BE
 * @license Apache-2.0
 */

import { Request, Response, NextFunction } from 'express';
import logger from 'src/lib/logger';
import config from 'src/config';

export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  res.status(404).json({
    success: false,
    message: `Route không tồn tại: ${req.originalUrl}`,
  });
};

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  logger.error(
    `${err.name}: ${err.message}\n${err.stack}\nRequest: ${req.method} ${req.originalUrl}`,
  );

  const statusCode = res.statusCode !== 200 ? res.statusCode : 500;

  res.status(statusCode).json({
    success: false,
    message: err.message || 'Lỗi máy chủ nội bộ',
    stack: config.server.nodeEnv === 'production' ? '🥞' : err.stack,
  });
};
