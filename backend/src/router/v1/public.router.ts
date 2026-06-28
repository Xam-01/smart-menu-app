/**
 * @copyright 2026 MK-TS-04
 * @project SmartMenu BE
 * @license Apache-2.0
 */

import { Router } from 'express';
import { param } from 'express-validator';
import getMenuPublic from 'src/controller/v1/menu/get_menu_public';
import validationError from 'src/middleware/validationError';

const router = Router();

router.get(
  '/restaurants/:restaurantId/menu',
  [param('restaurantId').notEmpty()],
  validationError,
  getMenuPublic,
);

export default router;
