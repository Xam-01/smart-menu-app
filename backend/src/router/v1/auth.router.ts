/**
 * @copyright 2026 MK-TS-04
 * @project SmartMenu BE
 * @license Apache-2.0
 */

import { Router } from 'express';
import { body } from 'express-validator';
import register from 'src/controller/v1/auth/register';
import login from 'src/controller/v1/auth/login';
import refreshToken from 'src/controller/v1/auth/refresh_token';
import logout from 'src/controller/v1/auth/logout';
import validationError from 'src/middleware/validationError';
import { authenticate } from 'src/middleware/auth.middleware';

const router = Router();

router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail().withMessage('Email không hợp lệ'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Mật khẩu tối thiểu 8 ký tự'),
  ],
  validationError,
  register,
);

router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail().withMessage('Email không hợp lệ'),
    body('password').notEmpty().withMessage('Password là bắt buộc'),
  ],
  validationError,
  login,
);

router.post('/refresh-token', refreshToken);

router.post('/logout', authenticate, logout);

export default router;
