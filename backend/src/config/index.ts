/**
 * @copyright 2026 MK-TS-04
 * @project SmartMenu BE
 * @license Apache-2.0
 */

import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

dotenv.config();

const config = {
  server: {
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
  },
  db: {
    uri: process.env.MONGOOSE_URL,
  },
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'fallback_access_secret',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'fallback_refresh_secret',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  rateLimit: rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: {
      success: false,
      message: 'Quá nhiều request, vui lòng thử lại sau.',
    },
  }),
  session: {
    ttlSeconds: 4 * 60 * 60,
  },
  qrBaseUrl: process.env.QR_BASE_URL || 'http://localhost:3000/api/v1/sessions',
};

export default config;
