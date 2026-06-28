/**
 * @copyright 2026 MK-TS-04
 * @project SmartMenu BE
 * @license Apache-2.0
 */

import logger from 'src/lib/logger';
import Restaurant from 'src/model/restaurant.model';
import MenuItem from 'src/model/menu_item.model';
import type { Request, Response } from 'express';

const deleteMenuItem = async (req: Request, res: Response): Promise<void> => {
  const ownerId = req.userId!;
  const { menuId, itemId } = req.params;

  const restaurant = await Restaurant.findOne({ ownerId });
  if (!restaurant) {
    res.status(404).json({
      success: false,
      code: 'RESTAURANT_NOT_FOUND',
      message: 'Bạn chưa tạo nhà hàng',
    });
    return;
  }

  const deleted = await MenuItem.findOneAndDelete({
    _id: itemId,
    menuId,
    restaurantId: restaurant._id,
  });

  if (!deleted) {
    res.status(404).json({
      success: false,
      code: 'ITEM_NOT_FOUND',
      message: 'Món ăn không tồn tại',
    });
    return;
  }

  logger.info(`MenuItem deleted: ${itemId} by owner ${ownerId}`);

  res.status(200).json({ success: true, message: 'Món ăn đã được xóa' });
};

export default deleteMenuItem;
