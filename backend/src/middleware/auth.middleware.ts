/**
 * @copyright 2026 MK-TS-04
 * @project SmartMenu BE
 * @license Apache-2.0
 */

import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from 'src/lib/jwt';
import Owner from 'src/model/owner.model';

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      code: 'UNAUTHORIZED',
      message: 'Vui lòng cung cấp access token',
    });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = verifyAccessToken(token);

    const owner = await Owner.findById(payload.userId);
    if (!owner) {
      res.status(401).json({
        success: false,
        code: 'USER_NOT_FOUND',
        message: 'Tài khoản không tồn tại',
      });
      return;
    }

    req.userId = payload.userId;
    req.userRole = payload.role;

    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      code: 'INVALID_TOKEN',
      message: 'Token không hợp lệ hoặc đã hết hạn',
    });
  }
};
