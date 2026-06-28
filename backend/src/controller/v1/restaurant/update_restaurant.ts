/**
 * @copyright 2026 MK-TS-04
 * @project SmartMenu BE
 * @license Apache-2.0
 */

import logger from 'src/lib/logger';
import Restaurant from 'src/model/restaurant.model';
import type { Request, Response } from 'express';
import type { RestaurantStatus } from 'src/model/restaurant.model';

const updateRestaurant = async (req: Request, res: Response): Promise<void> => {
  const ownerId = req.userId!;
  const { id } = req.params;
  const { name, address, phone, description, status } = req.body as {
    name?: string;
    address?: string;
    phone?: string;
    description?: string;
    status?: RestaurantStatus;
  };

  const restaurant = await Restaurant.findOne({ _id: id, ownerId });
  if (!restaurant) {
    res.status(404).json({
      success: false,
      code: 'RESTAURANT_NOT_FOUND',
      message: 'Nhà hàng không tồn tại hoặc bạn không có quyền',
    });
    return;
  }

  const newName = name?.trim() || restaurant.name;
  const newAddress = address?.trim() || restaurant.address;
  if (
    (name || address) &&
    (newName !== restaurant.name || newAddress !== restaurant.address)
  ) {
    const conflict = await Restaurant.findOne({
      name: newName,
      address: newAddress,
      _id: { $ne: restaurant._id },
    });
    if (conflict) {
      res.status(409).json({
        success: false,
        code: 'RESTAURANT_NAME_TAKEN',
        message: 'Đã có nhà hàng với tên và địa chỉ này',
      });
      return;
    }
  }

  if (name) restaurant.name = name.trim();
  if (address) restaurant.address = address.trim();
  if (phone !== undefined) restaurant.phone = phone;
  if (description !== undefined) restaurant.description = description;
  if (status) restaurant.status = status;

  await restaurant.save();

  logger.info(`Restaurant updated: ${restaurant._id} by owner ${ownerId}`);

  res.status(200).json({
    success: true,
    message: 'Thông tin nhà hàng đã được cập nhật',
    data: {
      id: restaurant._id,
      name: restaurant.name,
      address: restaurant.address,
      phone: restaurant.phone,
      description: restaurant.description,
      status: restaurant.status,
      updatedAt: restaurant.updatedAt,
    },
  });
};

export default updateRestaurant;
