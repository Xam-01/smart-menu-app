/**
 * @copyright 2026 MK-TS-04
 * @project SmartMenu BE
 * @license Apache-2.0
 */

import logger from 'src/lib/logger';
import config from 'src/config';
import {
  verifyRefreshToken,
  generateAccessToken,
  generateRefreshToken,
} from 'src/lib/jwt';
import Token from 'src/model/token.model';
import Owner from 'src/model/owner.model';
import type { Request, Response } from 'express';

const refreshToken = async (req: Request, res: Response): Promise<void> => {
  const token = req.cookies?.refreshToken as string | undefined;

  if (!token) {
    res.status(401).json({
      success: false,
      code: 'NO_REFRESH_TOKEN',
      message: 'Refresh token không tồn tại',
    });
    return;
  }

  let payload: { userId: string; role: string };
  try {
    payload = verifyRefreshToken(token);
  } catch {
    res.status(401).json({
      success: false,
      code: 'INVALID_REFRESH_TOKEN',
      message: 'Refresh token không hợp lệ hoặc đã hết hạn',
    });
    return;
  }

  const storedToken = await Token.findOne({ token });
  if (!storedToken) {
    res.status(401).json({
      success: false,
      code: 'TOKEN_REVOKED',
      message: 'Refresh token đã bị thu hồi',
    });
    return;
  }

  const owner = await Owner.findById(payload.userId);
  if (!owner) {
    res.status(401).json({
      success: false,
      code: 'USER_NOT_FOUND',
      message: 'Tài khoản không tồn tại',
    });
    return;
  }

  const newPayload = { userId: owner._id.toString(), role: owner.role };
  const newAccessToken = generateAccessToken(newPayload);
  const newRefreshToken = generateRefreshToken(newPayload);

  await Token.deleteOne({ token });
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);
  await Token.create({ userId: owner._id, token: newRefreshToken, expiresAt });

  res.cookie('refreshToken', newRefreshToken, {
    httpOnly: true,
    secure: config.server.nodeEnv === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  logger.info(`Token refreshed for owner: ${owner.email}`);

  res.status(200).json({
    success: true,
    message: 'Token đã được làm mới',
    data: { accessToken: newAccessToken },
  });
};

export default refreshToken;
