/**
 * @copyright 2026 MK-TS-04
 * @project SmartMenu BE
 * @license Apache-2.0
 */

import Session from 'src/model/session.model';
import Order from 'src/model/order.model';
import type { Request, Response } from 'express';

const getSessionOrders = async (req: Request, res: Response): Promise<void> => {
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

  const orders = await Order.find({ sessionId })
    .sort({ createdAt: -1 })
    .select('-__v');

  res.status(200).json({
    success: true,
    message: 'Đơn hàng của bạn',
    data: orders.map((o) => ({
      id: o._id,
      tableNumber: o.tableNumber,
      items: o.items.map((item) => ({
        nameVi: item.nameVi,
        price: item.price,
        quantity: item.quantity,
        notes: item.notes,
      })),
      status: o.status,
      totalPrice: o.totalPrice,
      allergyNotes: o.allergyNotes,
      customerNotes: o.customerNotes,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
    })),
    meta: { total: orders.length },
  });
};

export default getSessionOrders;
