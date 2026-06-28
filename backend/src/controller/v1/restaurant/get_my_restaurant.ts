/**
 * @copyright 2026 MK-TS-04
 * @project SmartMenu BE
 * @license Apache-2.0
 */

import Restaurant from 'src/model/restaurant.model';
import type { Request, Response } from 'express';

const getMyRestaurant = async (req: Request, res: Response): Promise<void> => {
  const ownerId = req.userId!;

  const restaurant = await Restaurant.findOne({ ownerId });
  if (!restaurant) {
    res.status(404).json({
      success: false,
      code: 'RESTAURANT_NOT_FOUND',
      message: 'Bạn chưa tạo nhà hàng',
    });
    return;
  }

  res.status(200).json({
    success: true,
    message: 'Thông tin nhà hàng',
    data: {
      id: restaurant._id,
      name: restaurant.name,
      address: restaurant.address,
      phone: restaurant.phone,
      description: restaurant.description,
      tableCount: restaurant.tableCount,
      status: restaurant.status,
      tables: restaurant.tables.map((t) => ({
        tableNumber: t.tableNumber,
        qrCode: t.qrCode,
        isActive: t.isActive,
      })),
      createdAt: restaurant.createdAt,
      updatedAt: restaurant.updatedAt,
    },
  });
};

export default getMyRestaurant;
