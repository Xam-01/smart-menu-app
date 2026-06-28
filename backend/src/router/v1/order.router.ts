/**
 * @copyright 2026 MK-TS-04
 * @project SmartMenu BE
 * @license Apache-2.0
 */

import { Router } from 'express';
import { body, param } from 'express-validator';
import createOrder from 'src/controller/v1/order/create_order';
import getOrders from 'src/controller/v1/order/get_orders';
import updateOrderStatus from 'src/controller/v1/order/update_order_status';
import getSessionOrders from 'src/controller/v1/order/get_session_orders';
import validationError from 'src/middleware/validationError';
import { authenticate } from 'src/middleware/auth.middleware';

const router = Router();

router.post(
  '/',
  [
    body('sessionId').notEmpty().withMessage('sessionId là bắt buộc'),
    body('items')
      .isArray({ min: 1 })
      .withMessage('Đơn hàng phải có ít nhất 1 món'),
    body('items.*.menuItemId').notEmpty().withMessage('menuItemId là bắt buộc'),
    body('items.*.quantity')
      .isInt({ min: 1, max: 20 })
      .withMessage('Số lượng phải từ 1 đến 20'),
    body('customerNotes')
      .optional()
      .isLength({ max: 200 })
      .withMessage('Ghi chú tối đa 200 ký tự'),
  ],
  validationError,
  createOrder,
);

router.get('/', authenticate, getOrders);

router.patch(
  '/:orderId/status',
  authenticate,
  [
    param('orderId').notEmpty(),
    body('status')
      .isIn([
        'confirmed',
        'preparing',
        'ready',
        'served',
        'completed',
        'cancelled',
      ])
      .withMessage('Trạng thái không hợp lệ'),
  ],
  validationError,
  updateOrderStatus,
);

router.get(
  '/session/:sessionId',
  [param('sessionId').notEmpty()],
  validationError,
  getSessionOrders,
);

export default router;
