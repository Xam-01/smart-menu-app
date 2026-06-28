/**
 * @copyright 2026 MK-TS-04
 * @project SmartMenu BE
 * @license Apache-2.0
 */

import logger from 'src/lib/logger';
import Restaurant from 'src/model/restaurant.model';
import Menu from 'src/model/menu.model';
import type { Request, Response } from 'express';

const publishMenu = async (req: Request, res: Response): Promise<void> => {
  const ownerId = req.userId!;
  const { menuId } = req.params;

  const restaurant = await Restaurant.findOne({ ownerId });
  if (!restaurant) {
    res.status(404).json({
      success: false,
      code: 'RESTAURANT_NOT_FOUND',
      message: 'Bạn chưa tạo nhà hàng',
    });
    return;
  }

  const menu = await Menu.findOne({
    _id: menuId,
    restaurantId: restaurant._id,
    status: 'draft',
  });
  if (!menu) {
    res.status(404).json({
      success: false,
      code: 'MENU_NOT_FOUND',
      message: 'Menu không tồn tại hoặc không ở trạng thái draft',
    });
    return;
  }

  await Menu.updateMany(
    {
      restaurantId: restaurant._id,
      status: 'published',
      _id: { $ne: menu._id },
    },
    { status: 'archived', archivedAt: new Date() },
  );

  menu.status = 'published';
  menu.publishedAt = new Date();
  await menu.save();

  logger.info(`Menu published: ${menu._id} for restaurant ${restaurant._id}`);

  res.status(200).json({
    success: true,
    message: 'Menu đã được publish thành công',
    data: {
      id: menu._id,
      version: menu.version,
      status: menu.status,
      publishedAt: menu.publishedAt,
    },
  });
};

export default publishMenu;
