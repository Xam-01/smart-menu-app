/**
 * @copyright 2026 MK-TS-04
 * @project SmartMenu BE
 * @license Apache-2.0
 */

import Restaurant from 'src/model/restaurant.model';
import Order from 'src/model/order.model';
import type { Request, Response } from 'express';

const getOrders = async (req: Request, res: Response): Promise<void> => {
  const ownerId = req.userId!;
  const {
    status,
    tableNumber,
    page = '1',
    limit = '20',
  } = req.query as {
    status?: string;
    tableNumber?: string;
    page?: string;
    limit?: string;
  };

  const restaurant = await Restaurant.findOne({ ownerId });
  if (!restaurant) {
    res.status(404).json({
      success: false,
      code: 'RESTAURANT_NOT_FOUND',
      message: 'Bạn chưa tạo nhà hàng',
    });
    return;
  }

  const filter: Record<string, unknown> = { restaurantId: restaurant._id };
  if (status) filter.status = status;
  if (tableNumber) filter.tableNumber = Number(tableNumber);

  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(50, parseInt(limit, 10));
  const skip = (pageNum - 1) * limitNum;

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .select('-__v'),
    Order.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    message: 'Danh sách đơn hàng',
    data: orders.map((o) => ({
      id: o._id,
      tableNumber: o.tableNumber,
      items: o.items,
      status: o.status,
      allergyNotes: o.allergyNotes,
      customerNotes: o.customerNotes,
      totalPrice: o.totalPrice,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
    })),
    meta: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    },
  });
};

export default getOrders;
