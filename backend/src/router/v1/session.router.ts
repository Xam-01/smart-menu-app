/**
 * @copyright 2026 MK-TS-04
 * @project SmartMenu BE
 * @license Apache-2.0
 */

import { Router } from 'express';
import { body, param } from 'express-validator';
import createSession from 'src/controller/v1/session/create_session';
import updateAllergens from 'src/controller/v1/session/update_allergens';
import validationError from 'src/middleware/validationError';

const router = Router();

router.post(
  '/',
  [
    body('restaurantId').notEmpty().withMessage('restaurantId là bắt buộc'),
    body('tableNumber')
      .isInt({ min: 1 })
      .withMessage('tableNumber phải là số nguyên dương'),
    body('qrSecret').notEmpty().withMessage('qrSecret là bắt buộc'),
  ],
  validationError,
  createSession,
);

router.patch(
  '/:sessionId/allergens',
  [
    param('sessionId').notEmpty(),
    body('allergens')
      .isArray()
      .withMessage('allergens phải là mảng các chất gây dị ứng'),
  ],
  validationError,
  updateAllergens,
);

export default router;
