/**
 * @copyright 2026 MK-TS-04
 * @project SmartMenu BE
 * @license Apache-2.0
 */

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userRole?: string;
      sessionId?: string;
    }
  }
}

export {};
