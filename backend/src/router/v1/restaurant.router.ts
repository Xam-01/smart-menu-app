/**
 * @copyright 2026 MK-TS-04
 * @project SmartMenu BE
 * @license Apache-2.0
 */

import { Router } from 'express';
import { body, param } from 'express-validator';
import createRestaurant from 'src/controller/v1/restaurant/create_restaurant';
import getMyRestaurant from 'src/controller/v1/restaurant/get_my_restaurant';
import updateRestaurant from 'src/controller/v1/restaurant/update_restaurant';
import getTableQr from 'src/controller/v1/restaurant/get_table_qr';
import revokeTableQr from 'src/controller/v1/restaurant/revoke_table_qr';
import validationError from 'src/middleware/validationError';
import { authenticate } from 'src/middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.post(
  '/',
  [
    body('name').notEmpty().trim().withMessage('Tên nhà hàng là bắt buộc'),
    body('address').notEmpty().trim().withMessage('Địa chỉ là bắt buộc'),
    body('tableCount')
      .isInt({ min: 1, max: 200 })
      .withMessage('Số bàn phải từ 1 đến 200'),
    body('phone').optional().isString(),
    body('description').optional().isLength({ max: 1000 }),
  ],
  validationError,
  createRestaurant,
);

router.get('/me', getMyRestaurant);

router.patch(
  '/:id',
  [
    param('id').notEmpty(),
    body('status')
      .optional()
      .isIn(['active', 'inactive', 'suspended'])
      .withMessage('Trạng thái không hợp lệ'),
  ],
  validationError,
  updateRestaurant,
);

router.get(
  '/:restaurantId/tables/:tableNumber/qr',
  [param('restaurantId').notEmpty(), param('tableNumber').isInt()],
  validationError,
  getTableQr,
);

router.post(
  '/:restaurantId/tables/:tableNumber/qr/revoke',
  [param('restaurantId').notEmpty(), param('tableNumber').isInt()],
  validationError,
  revokeTableQr,
);

export default router;
