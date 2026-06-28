/**
 * @copyright 2026 MK-TS-04
 * @project SmartMenu BE
 * @license Apache-2.0
 */

import logger from 'src/lib/logger';
import Restaurant from 'src/model/restaurant.model';
import Menu from 'src/model/menu.model';
import type { Request, Response } from 'express';

const uploadMenu = async (req: Request, res: Response): Promise<void> => {
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

  const currentVersion = await Menu.countDocuments({
    restaurantId: restaurant._id,
  });

  await Menu.updateMany(
    { restaurantId: restaurant._id, status: 'published' },
    { status: 'archived', archivedAt: new Date() },
  );

  const newMenu = await Menu.create({
    restaurantId: restaurant._id,
    version: currentVersion + 1,
    status: 'draft',
    originalImagePath: req.body.imagePath || null,
    ocrStatus: 'pending',
    ocrJobId: `ocr-job-${Date.now()}`,
  });

  logger.info(
    `Menu upload initiated for restaurant ${restaurant._id}, version ${newMenu.version}`,
  );

  res.status(202).json({
    success: true,
    message: 'Menu đã được gửi để xử lý OCR. Vui lòng chờ...',
    data: {
      menuId: newMenu._id,
      version: newMenu.version,
      status: newMenu.status,
      ocrStatus: newMenu.ocrStatus,
      ocrJobId: newMenu.ocrJobId,
    },
  });
};

export default uploadMenu;
