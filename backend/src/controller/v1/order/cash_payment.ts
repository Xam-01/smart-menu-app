/**
 * @copyright 2026 MK-TS-04
 * @project SmartMenu BE
 * @license Apache-2.0
 */

import logger from 'src/lib/logger';
import Session from 'src/model/session.model';
import Order from 'src/model/order.model';
import type { Request, Response } from 'express';

const cashPayment = async (req: Request, res: Response): Promise<void> => {
  const { sessionId } = req.params;

  const session = await Session.findOne({ sessionId });
  if (!session || session.expiresAt < new Date()) {
    res.status(401).json({
      success: false,
      code: 'SESSION_INVALID',
      message: 'Session không hợp lệ hoặc đã hết hạn',
    });
    return;
  }

  const now = new Date();
  await Order.updateMany(
    {
      sessionId,
      status: { $nin: ['completed', 'cancelled'] },
    },
    {
      status: 'completed',
      servedAt: now,
      completedAt: now,
    },
  );

  const orders = await Order.find({ sessionId }).sort({ createdAt: -1 }).select('-__v');
  const completedTotal = orders
    .filter((order) => order.status === 'completed')
    .reduce((sum, order) => sum + order.totalPrice, 0);

  logger.info(`Cash payment completed for session ${sessionId}`);

  res.status(200).json({
    success: true,
    message: 'Đã thanh toán tiền mặt',
    data: orders.map((order) => ({
      id: order._id,
      tableNumber: order.tableNumber,
      items: order.items.map((item) => ({
        nameVi: item.nameVi,
        price: item.price,
        quantity: item.quantity,
        notes: item.notes,
      })),
      status: order.status,
      totalPrice: order.totalPrice,
      allergyNotes: order.allergyNotes,
      customerNotes: order.customerNotes,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    })),
    meta: { total: orders.length, completedTotal },
  });
};

export default cashPayment;
