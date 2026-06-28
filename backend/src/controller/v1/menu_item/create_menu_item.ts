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
import type {
  MenuItemCategory,
  MenuItemStatus,
  IAllergenTag,
} from 'src/model/menu_item.model';

const createMenuItem = async (req: Request, res: Response): Promise<void> => {
  const ownerId = req.userId!;
  const { menuId } = req.params;
  const { nameVi, descVi, price, category, status, imageUrl, allergenTags } =
    req.body as {
      nameVi: string;
      descVi?: string;
      price: number;
      category: MenuItemCategory;
      status?: MenuItemStatus;
      imageUrl?: string;
      allergenTags?: IAllergenTag[];
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

  const itemCount = await MenuItem.countDocuments({
    restaurantId: restaurant._id,
  });
  if (itemCount >= 500) {
    res.status(422).json({
      success: false,
      code: 'MAX_ITEMS_REACHED',
      message: 'Nhà hàng đã đạt giới hạn 500 món',
    });
    return;
  }

  const menuItem = await MenuItem.create({
    menuId,
    restaurantId: restaurant._id,
    nameVi: nameVi.trim(),
    descVi: descVi?.trim(),
    price,
    category,
    status: status || 'available',
    imageUrl,
    allergenTags: allergenTags || [],
    allergenVerified: false,
    translations: [],
  });

  logger.info(`MenuItem created: ${menuItem._id} in menu ${menuId}`);

  res.status(201).json({
    success: true,
    message: 'Món ăn đã được tạo',
    data: {
      id: menuItem._id,
      nameVi: menuItem.nameVi,
      descVi: menuItem.descVi,
      price: menuItem.price,
      category: menuItem.category,
      status: menuItem.status,
      allergenTags: menuItem.allergenTags,
      allergenVerified: menuItem.allergenVerified,
    },
  });
};

export default createMenuItem;
