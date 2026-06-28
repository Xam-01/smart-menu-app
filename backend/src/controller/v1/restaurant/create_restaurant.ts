/**
 * @copyright 2026 MK-TS-04
 * @project SmartMenu BE
 * @license Apache-2.0
 */

import crypto from 'crypto';
import logger from 'src/lib/logger';
import config from 'src/config';
import Restaurant from 'src/model/restaurant.model';
import type { Request, Response } from 'express';
import type { ITable } from 'src/model/restaurant.model';

const createRestaurant = async (req: Request, res: Response): Promise<void> => {
  const ownerId = req.userId!;
  const { name, address, phone, description, tableCount } = req.body as {
    name: string;
    address: string;
    phone?: string;
    description?: string;
    tableCount: number;
  };

  const existing = await Restaurant.findOne({
    name: name.trim(),
    address: address.trim(),
  });
  if (existing) {
    res.status(409).json({
      success: false,
      code: 'RESTAURANT_NAME_TAKEN',
      message: 'Đã có nhà hàng với tên và địa chỉ này',
    });
    return;
  }

  const tables: ITable[] = [];
  for (let i = 1; i <= tableCount; i++) {
    const qrSecret = crypto.randomBytes(16).toString('hex');
    const qrPayload = Buffer.from(
      JSON.stringify({ tableNumber: i, qrSecret }),
    ).toString('base64');
    tables.push({
      tableNumber: i,
      qrCode: `${config.qrBaseUrl}/scan?data=${qrPayload}`,
      qrSecret,
      isActive: true,
    });
  }

  const restaurant = await Restaurant.create({
    ownerId,
    name: name.trim(),
    address: address.trim(),
    phone,
    description,
    tableCount,
    tables,
    status: 'active',
  });

  restaurant.tables = restaurant.tables.map((table) => {
    const qrPayload = Buffer.from(
      JSON.stringify({
        restaurantId: restaurant._id.toString(),
        tableNumber: table.tableNumber,
        qrSecret: table.qrSecret,
      }),
    ).toString('base64');
    table.qrCode = `${config.qrBaseUrl}/scan?data=${qrPayload}`;
    return table;
  });
  await restaurant.save();

  logger.info(`Restaurant created: ${restaurant.name} by owner ${ownerId}`);

  res.status(201).json({
    success: true,
    message: 'Nhà hàng đã được tạo',
    data: {
      id: restaurant._id,
      name: restaurant.name,
      address: restaurant.address,
      phone: restaurant.phone,
      description: restaurant.description,
      tableCount: restaurant.tableCount,
      status: restaurant.status,
      tables: restaurant.tables.map((t) => ({
        tableNumber: t.tableNumber,
        qrCode: t.qrCode,
        isActive: t.isActive,
      })),
    },
  });
};

export default createRestaurant;
