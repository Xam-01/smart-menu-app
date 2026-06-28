/**
 * @copyright 2026 MK-TS-04
 * @project SmartMenu BE
 * @license Apache-2.0
 */

import logger from 'src/lib/logger';
import Token from 'src/model/token.model';
import type { Request, Response } from 'express';

const logout = async (req: Request, res: Response): Promise<void> => {
  const token = req.cookies?.refreshToken as string | undefined;

  if (token) {
    await Token.deleteOne({ token });
  }

  res.clearCookie('refreshToken', { httpOnly: true, sameSite: 'strict' });

  logger.info(`Owner logged out (userId: ${req.userId})`);

  res.status(200).json({ success: true, message: 'Đăng xuất thành công' });
};

export default logout;
