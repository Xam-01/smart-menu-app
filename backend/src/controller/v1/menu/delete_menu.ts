/**
 * @copyright 2026 MK-TS-04
 * @project SmartMenu BE
 * @license Apache-2.0
 */

import logger from 'src/lib/logger';
import Restaurant from 'src/model/restaurant.model';
import Menu from 'src/model/menu.model';
import MenuItem from 'src/model/menu_item.model';
import type { Request, Response } from 'express';

const deleteMenu = async (req: Request, res: Response): Promise<void> => {
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
  });
  if (!menu) {
    res.status(404).json({
      success: false,
      code: 'MENU_NOT_FOUND',
      message: 'Menu không tồn tại',
    });
    return;
  }

  if (menu.status === 'published') {
    menu.status = 'archived';
    menu.archivedAt = new Date();
    await menu.save();

    logger.info(`Published menu archived: ${menuId} by owner ${ownerId}`);
    res.status(200).json({
      success: true,
      message: 'Menu đang publish đã được lưu trữ',
      data: {
        id: menu._id,
        version: menu.version,
        status: menu.status,
        archivedAt: menu.archivedAt,
      },
    });
    return;
  }

  await Promise.all([
    MenuItem.deleteMany({ menuId: menu._id, restaurantId: restaurant._id }),
    Menu.deleteOne({ _id: menu._id, restaurantId: restaurant._id }),
  ]);

  logger.info(`Menu deleted: ${menuId} by owner ${ownerId}`);
  res.status(200).json({
    success: true,
    message: 'Menu đã được xóa',
    data: {
      id: menu._id,
      version: menu.version,
      status: 'deleted',
    },
  });
};

export default deleteMenu;
