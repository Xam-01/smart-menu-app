/**
 * @copyright 2026 MK-TS-04
 * @project SmartMenu BE
 * @license Apache-2.0
 */

import Restaurant from 'src/model/restaurant.model';
import Menu from 'src/model/menu.model';
import type { Request, Response } from 'express';

const updateMenu = async (req: Request, res: Response): Promise<void> => {
  const ownerId = req.userId!;
  const { menuId } = req.params;
  const { name, imageUrl } = req.body as {
    name?: string;
    imageUrl?: string;
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

  const menu = await Menu.findOne({ _id: menuId, restaurantId: restaurant._id });
  if (!menu) {
    res.status(404).json({
      success: false,
      code: 'MENU_NOT_FOUND',
      message: 'Menu không tồn tại',
    });
    return;
  }

  if (name !== undefined) menu.name = name.trim() || `Menu v${menu.version}`;
  if (imageUrl !== undefined) menu.imageUrl = imageUrl;
  await menu.save();

  res.status(200).json({
    success: true,
    message: 'Menu đã được cập nhật',
    data: {
      id: menu._id,
      name: menu.name,
      version: menu.version,
      status: menu.status,
      imageUrl: menu.imageUrl,
      ocrStatus: menu.ocrStatus,
      publishedAt: menu.publishedAt,
      archivedAt: menu.archivedAt,
      createdAt: menu.createdAt,
    },
  });
};

export default updateMenu;
