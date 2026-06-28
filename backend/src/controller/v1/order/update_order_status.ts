/**
 * @copyright 2026 MK-TS-04
 * @project SmartMenu BE
 * @license Apache-2.0
 */

import logger from 'src/lib/logger';
import Restaurant from 'src/model/restaurant.model';
import Order from 'src/model/order.model';
import type { Request, Response } from 'express';
import type { OrderStatus } from 'src/model/order.model';

const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['ready'],
  ready: ['served'],
  served: ['completed'],
  completed: [],
  cancelled: [],
};

const updateOrderStatus = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const ownerId = req.userId!;
  const { orderId } = req.params;
  const { status } = req.body as { status: OrderStatus };

  const restaurant = await Restaurant.findOne({ ownerId });
  if (!restaurant) {
    res.status(404).json({
      success: false,
      code: 'RESTAURANT_NOT_FOUND',
      message: 'Bạn chưa tạo nhà hàng',
    });
    return;
  }

  const order = await Order.findOne({
    _id: orderId,
    restaurantId: restaurant._id,
  });
  if (!order) {
    res.status(404).json({
      success: false,
      code: 'ORDER_NOT_FOUND',
      message: 'Đơn hàng không tồn tại',
    });
    return;
  }

  const allowedNext = VALID_TRANSITIONS[order.status];
  if (!allowedNext.includes(status)) {
    res.status(422).json({
      success: false,
      code: 'INVALID_STATUS_TRANSITION',
      message: `Không thể chuyển từ "${order.status}" sang "${status}"`,
      data: { currentStatus: order.status, allowedNext },
    });
    return;
  }

  const oldStatus = order.status;
  order.status = status;

  if (status === 'served') order.servedAt = new Date();
  if (status === 'completed') order.completedAt = new Date();
  if (status === 'cancelled') order.cancelledAt = new Date();

  await order.save();

  logger.info(
    `Order ${orderId} status changed: ${oldStatus} → ${status} by owner ${ownerId}`,
  );

  res.status(200).json({
    success: true,
    message: `Trạng thái đơn đã cập nhật: ${status}`,
    data: {
      id: order._id,
      tableNumber: order.tableNumber,
      status: order.status,
      updatedAt: order.updatedAt,
    },
  });
};

export default updateOrderStatus;
