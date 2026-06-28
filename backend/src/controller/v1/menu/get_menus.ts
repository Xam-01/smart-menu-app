/**
 * @copyright 2026 MK-TS-04
 * @project SmartMenu BE
 * @license Apache-2.0
 */

import Restaurant from 'src/model/restaurant.model';
import Menu from 'src/model/menu.model';
import type { Request, Response } from 'express';

const getMenus = async (req: Request, res: Response): Promise<void> => {
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

  const menus = await Menu.find({ restaurantId: restaurant._id })
    .sort({ version: -1 })
    .select('-__v');

  res.status(200).json({
    success: true,
    message: 'Danh sách menu',
    data: menus.map((m) => ({
      id: m._id,
      version: m.version,
      status: m.status,
      ocrStatus: m.ocrStatus,
      publishedAt: m.publishedAt,
      archivedAt: m.archivedAt,
      createdAt: m.createdAt,
    })),
    meta: { total: menus.length },
  });
};

export default getMenus;
