/**
 * @copyright 2026 MK-TS-04
 * @project SmartMenu BE
 * @license Apache-2.0
 */

import logger from 'src/lib/logger';
import Restaurant from 'src/model/restaurant.model';
import MenuItem from 'src/model/menu_item.model';
import { ALLERGEN_TYPES } from 'src/model/session.model';
import type { Request, Response } from 'express';
import type { IAllergenTag } from 'src/model/menu_item.model';

const updateAllergens = async (req: Request, res: Response): Promise<void> => {
  const ownerId = req.userId!;
  const { menuId, itemId } = req.params;
  const { allergenTags, verified } = req.body as {
    allergenTags: IAllergenTag[];
    verified?: boolean;
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

  const invalidAllergens = allergenTags.filter(
    (t) => !ALLERGEN_TYPES.includes(t.allergen),
  );
  if (invalidAllergens.length > 0) {
    res.status(422).json({
      success: false,
      code: 'INVALID_ALLERGENS',
      message: `Allergen không hợp lệ: ${invalidAllergens.map((t) => t.allergen).join(', ')}`,
    });
    return;
  }

  const validConfidence = ['contains', 'may_contain', 'unknown'];
  const invalidConfidence = allergenTags.filter(
    (t) => !validConfidence.includes(t.confidence),
  );
  if (invalidConfidence.length > 0) {
    res.status(422).json({
      success: false,
      code: 'INVALID_CONFIDENCE',
      message: 'confidence phải là: contains, may_contain hoặc unknown',
    });
    return;
  }

  menuItem.allergenTags = allergenTags.map((t) => ({
    allergen: t.allergen,
    confidence: t.confidence,
    source: 'owner_verified' as const,
  }));

  if (verified === true) menuItem.allergenVerified = true;

  await menuItem.save();

  logger.info(`Allergens updated for item ${itemId} by owner ${ownerId}`);

  res.status(200).json({
    success: true,
    message: 'Thông tin dị ứng đã được cập nhật',
    data: {
      id: menuItem._id,
      allergenTags: menuItem.allergenTags,
      allergenVerified: menuItem.allergenVerified,
    },
  });
};

export default updateAllergens;
