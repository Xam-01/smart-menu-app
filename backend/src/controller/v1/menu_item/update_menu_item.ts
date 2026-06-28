/**
 * @copyright 2026 MK-TS-04
 * @project SmartMenu BE
 * @license Apache-2.0
 */

import logger from 'src/lib/logger';
import Restaurant from 'src/model/restaurant.model';
import MenuItem from 'src/model/menu_item.model';
import type { Request, Response } from 'express';
import type { MenuItemStatus } from 'src/model/menu_item.model';

const updateMenuItem = async (req: Request, res: Response): Promise<void> => {
  const ownerId = req.userId!;
  const { menuId, itemId } = req.params;
  const { nameVi, descVi, price, category, status, imageUrl } = req.body as {
    nameVi?: string;
    descVi?: string;
    price?: number;
    category?: string;
    status?: MenuItemStatus;
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

  const menuItem = await MenuItem.findOne({
    _id: itemId,
    menuId,
    restaurantId: restaurant._id,
  });
  if (!menuItem) {
    res.status(404).json({
      success: false,
      code: 'ITEM_NOT_FOUND',
      message: 'Món ăn không tồn tại',
    });
    return;
  }

  if (nameVi) menuItem.nameVi = nameVi.trim();
  if (descVi !== undefined) menuItem.descVi = descVi.trim();
  if (price !== undefined) menuItem.price = price;
  if (category) menuItem.category = category as typeof menuItem.category;
  if (status) menuItem.status = status;
  if (imageUrl !== undefined) menuItem.imageUrl = imageUrl;

  if (nameVi || descVi !== undefined) {
    menuItem.translations = [];
  }

  await menuItem.save();

  logger.info(`MenuItem updated: ${itemId} by owner ${ownerId}`);

  res.status(200).json({
    success: true,
    message: 'Món ăn đã được cập nhật',
    data: {
      id: menuItem._id,
      nameVi: menuItem.nameVi,
      descVi: menuItem.descVi,
      price: menuItem.price,
      category: menuItem.category,
      status: menuItem.status,
      imageUrl: menuItem.imageUrl,
      allergenVerified: menuItem.allergenVerified,
      updatedAt: menuItem.updatedAt,
    },
  });
};

export default updateMenuItem;
