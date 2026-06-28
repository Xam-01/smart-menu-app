/**
 * @copyright 2026 MK-TS-04
 * @project SmartMenu BE
 * @license Apache-2.0
 */

import bcryptjs from 'bcryptjs';
import logger from 'src/lib/logger';
import config from 'src/config';
import { generateAccessToken, generateRefreshToken } from 'src/lib/jwt';
import Owner from 'src/model/owner.model';
import Token from 'src/model/token.model';
import type { Request, Response } from 'express';

const login = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body as { email: string; password: string };

  const owner = await Owner.findOne({ email: email.toLowerCase() });
  if (!owner) {
    res.status(401).json({
      success: false,
      code: 'INVALID_CREDENTIALS',
      message: 'Email hoặc mật khẩu không đúng',
    });
    return;
  }

  const isPasswordValid = await bcryptjs.compare(password, owner.password);
  if (!isPasswordValid) {
    res.status(401).json({
      success: false,
      code: 'INVALID_CREDENTIALS',
      message: 'Email hoặc mật khẩu không đúng',
    });
    return;
  }

  const payload = { userId: owner._id.toString(), role: owner.role };
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  await Token.deleteMany({ userId: owner._id });
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);
  await Token.create({ userId: owner._id, token: refreshToken, expiresAt });

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: config.server.nodeEnv === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  logger.info(`Owner logged in: ${owner.email}`);

  res.status(200).json({
    success: true,
    message: 'Đăng nhập thành công',
    data: {
      accessToken,
      owner: { id: owner._id, email: owner.email, role: owner.role },
    },
  });
};

export default login;
