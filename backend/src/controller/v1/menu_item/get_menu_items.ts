/**
 * @copyright 2026 MK-TS-04
 * @project SmartMenu BE
 * @license Apache-2.0
 */

import Restaurant from 'src/model/restaurant.model';
import MenuItem from 'src/model/menu_item.model';
import type { Request, Response } from 'express';

const getMenuItems = async (req: Request, res: Response): Promise<void> => {
  const ownerId = req.userId!;
  const { menuId } = req.params;
  const { category, status } = req.query as {
    category?: string;
    status?: string;
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

  const filter: Record<string, unknown> = {
    menuId,
    restaurantId: restaurant._id,
  };
  if (category) filter.category = category;
  if (status) filter.status = status;

  const items = await MenuItem.find(filter)
    .sort({ category: 1, nameVi: 1 })
    .select('-__v -translations');

  res.status(200).json({
    success: true,
    message: 'Danh sách món ăn',
    data: items.map((item) => ({
      id: item._id,
      nameVi: item.nameVi,
      descVi: item.descVi,
      price: item.price,
      category: item.category,
      status: item.status,
      imageUrl: item.imageUrl,
      allergenTags: item.allergenTags,
      allergenVerified: item.allergenVerified,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    })),
    meta: { total: items.length },
  });
};

export default getMenuItems;
