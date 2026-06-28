/**
 * @copyright 2026 MK-TS-04
 * @project SmartMenu BE
 * @license Apache-2.0
 */

import Restaurant from 'src/model/restaurant.model';
import type { Request, Response } from 'express';

const getTableQr = async (req: Request, res: Response): Promise<void> => {
  const ownerId = req.userId!;
  const { restaurantId, tableNumber } = req.params;

  const restaurant = await Restaurant.findOne({ _id: restaurantId, ownerId });
  if (!restaurant) {
    res.status(404).json({
      success: false,
      code: 'RESTAURANT_NOT_FOUND',
      message: 'Nhà hàng không tồn tại hoặc bạn không có quyền',
    });
    return;
  }

  const table = restaurant.tables.find(
    (t) => t.tableNumber === Number(tableNumber),
  );
  if (!table) {
    res.status(404).json({
      success: false,
      code: 'TABLE_NOT_FOUND',
      message: `Bàn số ${tableNumber} không tồn tại`,
    });
    return;
  }

  res.status(200).json({
    success: true,
    message: `QR code bàn ${tableNumber}`,
    data: {
      tableNumber: table.tableNumber,
      qrCode: table.qrCode,
      isActive: table.isActive,
    },
  });
};

export default getTableQr;
