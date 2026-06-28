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

const createSession = async (req: Request, res: Response): Promise<void> => {
  const { restaurantId, tableNumber, qrSecret } = req.body as {
    restaurantId: string;
    tableNumber: number;
    qrSecret: string;
  };

  const restaurant = await Restaurant.findById(restaurantId);
  if (!restaurant) {
    res.status(404).json({
      success: false,
      code: 'RESTAURANT_NOT_FOUND',
      message: 'Nhà hàng không tồn tại',
    });
    return;
  }

  if (restaurant.status !== 'active') {
    res.status(403).json({
      success: false,
      code: 'RESTAURANT_INACTIVE',
      message: 'Nhà hàng hiện không hoạt động',
    });
    return;
  }

  const table = restaurant.tables.find(
    (t) => t.tableNumber === Number(tableNumber) && t.isActive,
  );
  if (!table || table.qrSecret !== qrSecret) {
    res.status(401).json({
      success: false,
      code: 'INVALID_QR',
      message: 'QR code không hợp lệ hoặc đã bị thu hồi',
    });
    return;
  }

  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + config.session.ttlSeconds * 1000);

  const session = await Session.create({
    sessionId,
    restaurantId: restaurant._id,
    tableNumber: Number(tableNumber),
    allergens: [],
    preferences: [],
    expiresAt,
    lastInteractionAt: new Date(),
  });

  logger.info(
    `New guest session created: ${sessionId} for restaurant ${restaurantId} table ${tableNumber}`,
  );

  res.status(201).json({
    success: true,
    message: 'Session đã được tạo',
    data: {
      sessionId: session.sessionId,
      restaurantId: session.restaurantId,
      tableNumber: session.tableNumber,
      expiresAt: session.expiresAt,
    },
  });
};

export default createSession;
