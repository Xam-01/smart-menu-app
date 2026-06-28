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

const register = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body as { email: string; password: string };

  const existing = await Owner.findOne({ email: email.toLowerCase() });
  if (existing) {
    res.status(409).json({
      success: false,
      code: 'EMAIL_TAKEN',
      message: 'Email đã được sử dụng',
    });
    return;
  }

  const hashedPassword = await bcryptjs.hash(password, 12);

  const owner = await Owner.create({
    email: email.toLowerCase(),
    password: hashedPassword,
    role: 'owner',
  });

  const payload = { userId: owner._id.toString(), role: owner.role };
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);
  await Token.create({ userId: owner._id, token: refreshToken, expiresAt });

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: config.server.nodeEnv === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  logger.info(`New owner registered: ${owner.email}`);

  res.status(201).json({
    success: true,
    message: 'Đăng ký thành công',
    data: {
      accessToken,
      owner: { id: owner._id, email: owner.email, role: owner.role },
    },
  });
};

export default register;
