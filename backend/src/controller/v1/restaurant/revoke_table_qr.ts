/**
 * @copyright 2026 MK-TS-04
 * @project SmartMenu BE
 * @license Apache-2.0
 */

import crypto from 'crypto';
import logger from 'src/lib/logger';
import config from 'src/config';
import Restaurant from 'src/model/restaurant.model';
import Session from 'src/model/session.model';
import type { Request, Response } from 'express';

const revokeTableQr = async (req: Request, res: Response): Promise<void> => {
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

  const tableIndex = restaurant.tables.findIndex(
    (t) => t.tableNumber === Number(tableNumber),
  );
  if (tableIndex === -1) {
    res.status(404).json({
      success: false,
      code: 'TABLE_NOT_FOUND',
      message: `Bàn số ${tableNumber} không tồn tại`,
    });
    return;
  }

  const newSecret = crypto.randomBytes(16).toString('hex');
  const qrPayload = Buffer.from(
    JSON.stringify({
      restaurantId: restaurant._id.toString(),
      tableNumber: Number(tableNumber),
      qrSecret: newSecret,
    }),
  ).toString('base64');
  const newQrCode = `${config.qrBaseUrl}/scan?data=${qrPayload}`;

  restaurant.tables[tableIndex].qrSecret = newSecret;
  restaurant.tables[tableIndex].qrCode = newQrCode;
  await restaurant.save();

  await Session.deleteMany({
    restaurantId: restaurant._id,
    tableNumber: Number(tableNumber),
  });

  logger.info(
    `QR revoked for restaurant ${restaurantId} table ${tableNumber} by owner ${ownerId}`,
  );

  res.status(200).json({
    success: true,
    message: `QR code bàn ${tableNumber} đã được tái sinh`,
    data: { tableNumber: Number(tableNumber), qrCode: newQrCode },
  });
};

export default revokeTableQr;
